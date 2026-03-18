const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const { promisify } = require("util");
const cloudinary = require("cloudinary").v2;
const axios = require('axios');
const mongoose = require("mongoose");

const Book = require("../models/Book");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

const execAsync = promisify(exec);

/* -------------------- MODELS (Internal fallback) -------------------- */
const Folder = mongoose.models.Folder || mongoose.model("Folder", new mongoose.Schema({
    name: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}));

/* -------------------- CONFIG & DIRECTORIES -------------------- */
const pdfDir = path.join(__dirname, "../../temp/pdfs");
const coversDir = path.join(__dirname, "../../temp/covers");
fs.ensureDirSync(pdfDir);
fs.ensureDirSync(coversDir);

// File type validation — PDFs only
const upload = multer({
    dest: "temp/uploads/",
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"), false);
        }
    }
});

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
    lastAccessed: book.lastAccessed,
    createdAt: book.createdAt
});

/* ---------------- TOC & TEXT CLEANING HELPERS ---------------- */

function extractTOC(text) {
    const isTOCPage = /contents|table of contents/i.test(text);
    if (!isTOCPage) return [];

    const tocEntries = [];
    const tocRegex = /^([a-z\s\(\)]{3,}.*?)\s?[\.\-·_ ]{2,}\s?(\d+)$/gim;

    let match;
    while ((match = tocRegex.exec(text)) !== null) {
        const title = match[1].trim();
        if (title.length > 2 && !/^(page|contents)/i.test(title)) {
            tocEntries.push({
                text: title,
                page: parseInt(match[2]),
                type: 'visual'
            });
        }
    }
    return tocEntries;
}

function smartClean(text) {
    if (!text) return "";
    return text
        .split('\n')
        .map(line => line.trim())
        .join('\n')

        // 1. Merge hyphenated word breaks at line borders (e.g. "impor-\ntant" → "important")
        .replace(/(\w)-[ \t]*\n[ \t]*(\w)/g, '$1$2')

        // 2. Merge mid-sentence line breaks where next line starts lowercase
        //    [ \t]* handles trailing spaces pdftotext pads before the newline
        .replace(/([a-z,])[ \t]*\n[ \t]*([a-z])/g, '$1 $2')

        // 3. Merge mid-sentence breaks before proper nouns (e.g. "went to\nLondon")
        .replace(/([a-z,])[ \t]*\n[ \t]*([A-Z][a-z])/g, '$1 $2')

        // 4. Catch any remaining non-punctuation line breaks before lowercase/digits
        .replace(/([^\.\!\?\:\n])[ \t]*\n[ \t]*([a-z0-9])/g, '$1 $2')

        // 5. Collapse multiple spaces/tabs into one
        .replace(/[ \t]+/g, ' ')

        // 6. Collapse 3+ newlines into a clean paragraph break
        .replace(/\n{3,}/g, '\n\n')

        .trim();
}

function getPageCount(pdfPath) {
    return new Promise((resolve) => {
        exec(`pdfinfo "${pdfPath}" | grep Pages: | awk '{print $2}'`, (err, stdout) => {
            if (err) {
                console.warn("pdfinfo failed, defaulting to 1 page:", err.message);
                return resolve(1);
            }
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
        // Try digital text extraction first (non-blocking)
        const { stdout: digitalText } = await execAsync(
            `pdftotext -f ${pageNum} -l ${pageNum} "${pdfPath}" -`,
            { encoding: 'utf8' }
        );

        if (digitalText && digitalText.trim().length > 50) {
            return smartClean(digitalText.trim());
        }

        // Fall back to OCR (non-blocking)
        await execAsync(
            `pdftoppm -f ${pageNum} -l ${pageNum} -png -r 300 -singlefile "${pdfPath}" "${pageImgBase}"`
        );

        const scriptPath = path.join(__dirname, "../ocr_worker/ocr_service.py");
        const { stdout: ocrResult } = await execAsync(
            `python3 "${scriptPath}" "${pageImgFull}"`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }
        );

        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
        return smartClean(ocrResult);

    } catch (e) {
        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
        console.warn(`extractPageText failed for page ${pageNum}:`, e.message);
        return "";
    }
}

/* ---------------- ROUTES ---------------- */

// 1. GET RECENTLY ACCESSED BOOK (For Flutter "Continue Listening")
router.get("/continue", protect, async (req, res) => {
    try {
        const book = await Book.findOne({ user: req.user._id })
            .sort({ lastAccessed: -1 })
            .limit(1);

        if (!book) return res.json(null);
        res.json(formatBook(book));
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch continue book" });
    }
});

// 2. GET ALL BOOKS
router.get("/", protect, async (req, res) => {
    try {
        const books = await Book.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(books.map(formatBook));
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch library" });
    }
});

// 3. FOLDER ROUTES — must be before /:id to avoid being matched as an id
router.get("/folders", protect, async (req, res) => {
    try {
        const folders = await Folder.find({ user: req.user._id }).sort({ name: 1 });
        res.json(["All", ...folders.map(f => f.name)]);
    } catch {
        res.status(500).json({ error: "Failed to fetch folders" });
    }
});

router.post("/folders", protect, async (req, res) => {
    try {
        const folder = await Folder.create({ name: req.body.name, user: req.user._id });
        res.status(201).json(folder);
    } catch {
        res.status(400).json({ error: "Folder creation failed" });
    }
});

// 4. GET SINGLE BOOK
router.get("/:id", protect, async (req, res) => {
    try {
        const book = await Book.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { lastAccessed: Date.now() },
            { new: true }
        );
        if (!book) return res.status(404).json({ error: "Book not found" });
        res.json(formatBook(book));
    } catch (err) {
        res.status(500).json({ error: "Error fetching book" });
    }
});

// 5. LAZY LOAD PAGES
router.get("/:id/load-pages", protect, async (req, res) => {
    let tempPath = "";
    try {
        const book = await Book.findOne({ _id: req.params.id, user: req.user._id });
        if (!book) return res.status(404).json({ error: "Book not found" });

        if (book.status === 'processing_pages') {
            return res.status(429).json({ error: "Processing. Please wait." });
        }

        const startPage = (book.processedPages || 0) + 1;
        const endPage = Math.min(startPage + 4, book.totalPages);

        if (startPage > book.totalPages) return res.json({ addedText: "", status: "completed" });

        await Book.findByIdAndUpdate(req.params.id, { status: 'processing_pages' });
        tempPath = path.join(pdfDir, `temp_load_${book._id}.pdf`);

        if (!(await fs.pathExists(tempPath))) {
            // Timeout to prevent hanging on slow/large downloads
            const response = await axios.get(book.pdfPath, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            fs.writeFileSync(tempPath, Buffer.from(response.data));
        }

        let newTextParts = [];
        let newTOCEntries = [];

        for (let i = startPage; i <= endPage; i++) {
            const text = await extractPageText(tempPath, i);
            if (text) {
                newTextParts.push(`[PAGE_${i}]\n${text}`);
                if ((!book.toc || book.toc.length === 0) && i <= 10) {
                    newTOCEntries.push(...extractTOC(text));
                }
            }
        }

        const newText = newTextParts.join("\n\n");
        const currentContent = (book.content || "").trim();
        const updatedContent = currentContent ? (currentContent + "\n\n" + newText) : newText;
        const actualWordCount = updatedContent.split(/\s+/).filter(w => w.length > 0).length;

        const mergedTOC = [...(book.toc || []), ...newTOCEntries].filter((v, i, a) =>
            a.findIndex(t => (t.text === v.text && t.page === v.page)) === i
        );

        const updatedBook = await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent,
            processedPages: endPage,
            status: endPage >= book.totalPages ? 'completed' : 'processing',
            words: actualWordCount,
            toc: mergedTOC
        }, { new: true });

        if (updatedBook.status === 'completed' && await fs.pathExists(tempPath)) {
            await fs.remove(tempPath);
        }

        res.json({
            addedText: newText,
            processedPages: endPage,
            status: updatedBook.status,
            totalWords: actualWordCount,
            toc: mergedTOC
        });

    } catch (err) {
        console.error("load-pages error:", err.message);
        await Book.findByIdAndUpdate(req.params.id, { status: 'processing' });
        if (tempPath && await fs.pathExists(tempPath)) await fs.remove(tempPath);
        res.status(500).json({ error: "Lazy load failed" });
    }
});

// 6. UPLOAD NEW BOOK
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
            toc: [],
            lastAccessed: Date.now()
        });

        res.status(201).json(formatBook(book));

        // Background processing
        (async () => {
            try {
                const baseName = path.parse(req.file.filename).name;
                const outputPrefix = path.join(coversDir, baseName);

                const [cloudUrl, coverUrl] = await Promise.all([
                    cloudinary.uploader.upload(pdfDiskPath, {
                        folder: "storyteller_pdfs",
                        resource_type: "raw"
                    }).then(r => r.secure_url),
                    new Promise((resolve) => {
                        exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfDiskPath}" "${outputPrefix}"`, async (err) => {
                            if (err) return resolve(null);
                            const r = await cloudinary.uploader.upload(`${outputPrefix}.png`, { folder: "storyteller_covers" });
                            await fs.remove(`${outputPrefix}.png`);
                            resolve(r.secure_url);
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
                        const separator = (runningText.length > 0 && !runningText.endsWith('\n\n')) ? "\n\n" : "";
                        runningText += separator + `[PAGE_${i}]\n` + text;
                        if (i <= 10) runningTOC.push(...extractTOC(text));
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

            } catch (e) {
                console.error("Worker Error:", e.message);
                // Mark book as failed so Flutter can surface the error
                await Book.findByIdAndUpdate(book._id, { status: 'failed' });
                if (await fs.pathExists(pdfDiskPath)) await fs.remove(pdfDiskPath);
            }
        })();

    } catch (err) {
        res.status(500).json({ error: "Upload failed" });
    }
});

// 7. DELETE BOOK
router.delete("/:id", protect, async (req, res) => {
    try {
        const book = await Book.findOne({ _id: req.params.id, user: req.user._id });
        if (!book) return res.status(404).json({ error: "Book not found" });

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
            console.warn("Cloudinary cleanup failed:", cErr.message);
        }

        const tempPdf = path.join(pdfDir, `temp_load_${book._id}.pdf`);
        if (await fs.pathExists(tempPdf)) await fs.remove(tempPdf);

        await Book.findByIdAndDelete(req.params.id);
        res.json({ message: "Book deleted successfully" });

    } catch (err) {
        res.status(500).json({ error: "Failed to delete book" });
    }
});

module.exports = router;