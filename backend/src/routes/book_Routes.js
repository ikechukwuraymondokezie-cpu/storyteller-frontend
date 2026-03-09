const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec, execSync } = require("child_process");
const cloudinary = require("cloudinary").v2;
const axios = require('axios');
const mongoose = require("mongoose");

const Book = require("../models/Book");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

/* -------------------- MODELS (Internal fallback) -------------------- */
const Folder = mongoose.models.Folder || mongoose.model("Folder", new mongoose.Schema({
    name: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}));

/* -------------------- CONFIG & DIRECTORIES -------------------- */
// Using absolute paths based on the app root
const pdfDir = path.join(__dirname, "../../temp/pdfs");
const coversDir = path.join(__dirname, "../../temp/covers");
fs.ensureDirSync(pdfDir);
fs.ensureDirSync(coversDir);

const upload = multer({ dest: "temp/uploads/" });

/* ---------------- HELPERS ---------------- */

const formatBook = (book) => ({
    _id: book._id,
    title: book.title,
    cover: book.cover || null,
    url: book.pdfPath || null,
    folder: book.folder || "All",
    downloads: book.downloads || 0,
    ttsRequests: book.ttsRequests || 0,
    words: book.words || 0,
    content: book.content || "",
    status: book.status || "processing",
    totalPages: book.totalPages || 0,
    processedPages: book.processedPages || 0,
    summary: book.summary || "",
    toc: book.toc || [],
    createdAt: book.createdAt
});

function extractTOC(text) {
    const tocEntries = [];
    const tocRegex = /^(.*?)\s?[\.\-·_]{2,}\s?(\d+)$/gm;
    let match;
    while ((match = tocRegex.exec(text)) !== null) {
        tocEntries.push({
            text: match[1].trim(),
            page: parseInt(match[2]),
            type: 'visual'
        });
    }
    return tocEntries;
}

function smartClean(text) {
    if (!text) return "";
    return text
        .replace(/([a-z0-9])\s*(Chapter\s+\d+|Psalm|Section|BOOKS\s+BY|Part|Book|Lesson)/gi, '$1\n\n$2')
        .replace(/(Chapter\s+\d+.*?)\s+(The\s+authority|Because|In\s+the|For\s+this|When\s+we)/gi, '$1\n\n$2')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim();
}

function getPageCount(pdfPath) {
    return new Promise((resolve) => {
        exec(`pdfinfo "${pdfPath}" | grep Pages: | awk '{print $2}'`, (err, stdout) => {
            if (err) return resolve(1);
            const count = parseInt(stdout.trim());
            resolve(isNaN(count) ? 1 : count);
        });
    });
}

async function extractPageText(pdfPath, pageNum) {
    const uniqueId = Date.now() + "_" + Math.round(Math.random() * 1000);
    const pageImgBase = path.join(coversDir, `ocr_tmp_${pageNum}_${uniqueId}`);
    const pageImgFull = `${pageImgBase}.png`;

    try {
        const digitalText = execSync(`pdftotext -f ${pageNum} -l ${pageNum} -layout "${pdfPath}" -`, {
            encoding: 'utf8'
        }).trim();

        if (digitalText && digitalText.length > 50) {
            console.log(`✅ Page ${pageNum}: Digital text layer found.`);
            return smartClean(digitalText);
        }

        console.log(`📸 Page ${pageNum}: Running Local AI OCR (ocr_service.py)...`);

        await new Promise((resolve, reject) => {
            exec(`pdftoppm -f ${pageNum} -l ${pageNum} -png -r 300 -singlefile "${pdfPath}" "${pageImgBase}"`, (err) => {
                if (err) reject(err); else resolve();
            });
        });

        const scriptPath = path.join(__dirname, "../ocr_worker/ocr_service.py");
        const ocrResult = execSync(`python3 "${scriptPath}" "${pageImgFull}"`, {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10
        });

        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
        return smartClean(ocrResult);

    } catch (e) {
        console.error(`❌ Extraction Error on Page ${pageNum}:`, e.message);
        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
        return "";
    }
}

/* ---------------- ROUTES ---------------- */

router.get("/", protect, async (req, res) => {
    try {
        const books = await Book.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(books.map(formatBook));
    } catch (err) { res.status(500).json({ error: "Failed to fetch library" }); }
});

router.get("/:id/load-pages", protect, async (req, res) => {
    let tempPath = "";
    try {
        const book = await Book.findOne({ _id: req.params.id, user: req.user._id });
        if (!book) return res.status(404).json({ error: "Book not found" });

        const startPage = (book.processedPages || 0) + 1;
        const endPage = Math.min(startPage + 4, book.totalPages);

        if (startPage > book.totalPages) return res.json({ addedText: "", status: "completed" });

        tempPath = path.join(pdfDir, `temp_load_${book._id}.pdf`);

        if (!(await fs.pathExists(tempPath))) {
            const response = await axios.get(book.pdfPath, { responseType: 'arraybuffer' });
            await fs.writeFile(tempPath, Buffer.from(response.data));
        }

        let newTextParts = [];
        let newTOCEntries = [];

        for (let i = startPage; i <= endPage; i++) {
            const text = await extractPageText(tempPath, i);
            if (text) {
                newTextParts.push(text);
                newTOCEntries.push(...extractTOC(text));
            }
        }

        const newText = newTextParts.join("\n\n");
        const updatedContent = (book.content || "").trim() + "\n\n" + newText;
        const actualWordCount = updatedContent.split(/\s+/).filter(w => w.length > 0).length;

        const mergedTOC = [...(book.toc || []), ...newTOCEntries].filter((v, i, a) =>
            a.findIndex(t => (t.text === v.text && t.page === v.page)) === i
        );

        const updatedBook = await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent.trim(),
            processedPages: endPage,
            status: endPage >= book.totalPages ? 'completed' : 'processing',
            words: actualWordCount,
            toc: mergedTOC
        }, { new: true });

        if (updatedBook.status === 'completed' && await fs.pathExists(tempPath)) await fs.remove(tempPath);

        res.json({
            addedText: newText,
            processedPages: endPage,
            status: updatedBook.status,
            totalWords: actualWordCount,
            toc: mergedTOC
        });
    } catch (err) { res.status(500).json({ error: "Lazy load failed" }); }
});

router.post("/", protect, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const pdfDiskPath = req.file.path;
        const totalPages = await getPageCount(pdfDiskPath);

        const book = await Book.create({
            user: req.user._id,
            title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: "pending",
            cover: "https://via.placeholder.com/300x450?text=Processing...",
            folder: req.body.folder || "All",
            content: "",
            totalPages,
            processedPages: 0,
            status: 'processing',
            words: 0,
            toc: []
        });

        res.status(201).json(formatBook(book));

        (async () => {
            try {
                const baseName = path.parse(req.file.filename).name;
                const outputPrefix = path.join(coversDir, baseName);

                const [cloudUrl, coverUrl] = await Promise.all([
                    cloudinary.uploader.upload(pdfDiskPath, { folder: "storyteller_pdfs", resource_type: "raw" }).then(r => r.secure_url),
                    new Promise((resolve) => {
                        exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfDiskPath}" "${outputPrefix}"`, async (err) => {
                            if (err) return resolve(null);
                            const res = await cloudinary.uploader.upload(`${outputPrefix}.png`, { folder: "storyteller_covers" });
                            await fs.remove(`${outputPrefix}.png`);
                            resolve(res.secure_url);
                        });
                    })
                ]);

                await Book.findByIdAndUpdate(book._id, { pdfPath: cloudUrl, cover: coverUrl });

                let runningText = "";
                let runningTOC = [];
                const limit = Math.min(10, totalPages);

                for (let i = 1; i <= limit; i++) {
                    const text = await extractPageText(pdfDiskPath, i);
                    if (text) {
                        runningText += text + "\n\n";
                        runningTOC.push(...extractTOC(text));
                    }
                    await Book.findByIdAndUpdate(book._id, {
                        content: runningText.trim(),
                        processedPages: i,
                        words: runningText.split(/\s+/).filter(w => w.length > 0).length,
                        toc: runningTOC,
                        status: i >= totalPages ? 'completed' : 'processing'
                    });
                }
                if (await fs.pathExists(pdfDiskPath)) await fs.remove(pdfDiskPath);
            } catch (e) { console.error("Worker Error:", e); }
        })();
    } catch (err) { res.status(500).json({ error: "Upload failed" }); }
});

router.get("/folders", protect, async (req, res) => {
    try {
        const folders = await Folder.find({ user: req.user._id }).sort({ name: 1 });
        res.json(["All", ...folders.map(f => f.name)]);
    } catch { res.status(500).json({ error: "Failed to fetch folders" }); }
});

router.post("/folders", protect, async (req, res) => {
    try {
        const folder = await Folder.create({ name: req.body.name, user: req.user._id });
        res.status(201).json(folder);
    } catch { res.status(400).json({ error: "Folder creation failed" }); }
});

router.get("/:id", protect, async (req, res) => {
    try {
        const book = await Book.findOne({ _id: req.params.id, user: req.user._id });
        if (!book) return res.status(404).json({ error: "Unauthorized" });
        res.json(formatBook(book));
    } catch { res.status(500).json({ error: "Error fetching" }); }
});

// --- UPDATED DELETE ROUTE ---
router.delete("/:id", protect, async (req, res) => {
    try {
        const book = await Book.findOne({ _id: req.params.id, user: req.user._id });

        if (!book) {
            return res.status(404).json({ error: "Book not found or unauthorized" });
        }

        // 1. Cleanup Cloudinary (PDF and Cover)
        try {
            if (book.pdfPath && book.pdfPath.includes("cloudinary")) {
                const pdfId = `storyteller_pdfs/${path.parse(book.pdfPath).name}`;
                await cloudinary.uploader.destroy(pdfId, { resource_type: 'raw' });
            }
            if (book.cover && book.cover.includes("cloudinary")) {
                const coverId = `storyteller_covers/${path.parse(book.cover).name}`;
                await cloudinary.uploader.destroy(coverId);
            }
        } catch (cErr) {
            console.warn("Cloudinary cleanup partially failed, continuing...", cErr.message);
        }

        // 2. Cleanup Local Temp Files
        const tempPdf = path.join(pdfDir, `temp_load_${book._id}.pdf`);
        if (await fs.pathExists(tempPdf)) await fs.remove(tempPdf);

        // 3. Remove from Database
        await Book.findByIdAndDelete(req.params.id);

        res.json({ message: "Book deleted successfully" });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ error: "Failed to delete book" });
    }
});

module.exports = router;