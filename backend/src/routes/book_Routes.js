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

/* -------------------- MODELS -------------------- */
const Folder = mongoose.models.Folder || mongoose.model("Folder", new mongoose.Schema({
    name: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}));

/* -------------------- CONFIG -------------------- */
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

/**
 * REFINED TOC EXTRACTION
 * Catures "Speechify" style patterns like "The Riddle House - 3"
 */
function extractTOC(text) {
    const tocEntries = [];
    const tocRegex = /^\s*([A-Z\d\s\-\.]{3,})\s*[.\-·_ ]{0,}\s*(\d+)\s*$/gim;

    let match;
    while ((match = tocRegex.exec(text)) !== null) {
        let title = match[1].trim().replace(/\.+$/, "").trim();
        const pageNum = parseInt(match[2]);

        if (title.length > 2 && !/^(page|contents|table of|index)/i.test(title)) {
            tocEntries.push({
                text: title,
                page: pageNum,
                type: 'visual'
            });
        }
    }
    return tocEntries;
}

/**
 * SPEECHIFY-STYLE SMART CLEAN
 * 1. Merges broken paragraph lines (missing punctuation).
 * 2. Keeps headers (Short, uppercase, or starting with "Chapter") separate.
 */
function smartClean(text) {
    if (!text) return "";

    // Normalize spacing and split into lines
    let rawLines = text.split('\n').map(line => line.trim()).filter(l => l.length > 0);
    let processed = [];

    for (let i = 0; i < rawLines.length; i++) {
        let currentLine = rawLines[i];

        // 1. Header Detection (Chapter headings or short lines)
        const isChapterHeader = /^(chapter|part|section|one|two|three|four|five|[\d\.]{1,3})\b/i.test(currentLine);
        const isShortHeader = currentLine.length < 35 && !/[.!?]$/.test(currentLine);

        if (isChapterHeader || isShortHeader) {
            // Check if we should merge with next line (e.g., "CHAPTER ONE" + "THE SCAR")
            if (i + 1 < rawLines.length && rawLines[i+1].length < 40 && !/[.!?]$/.test(rawLines[i+1])) {
                processed.push(currentLine.toUpperCase() + " " + rawLines[i+1].toUpperCase());
                i++; // Skip the merged line
            } else {
                processed.push(currentLine.toUpperCase());
            }
            continue;
        }

        // 2. Sentence Stitching
        // If line doesn't end in punctuation, merge with the next line
        const endsInSentence = /[.!?:"]\s*$/.test(currentLine);

        if (!endsInSentence && i + 1 < rawLines.length) {
            rawLines[i + 1] = currentLine + " " + rawLines[i + 1];
        } else {
            processed.push(currentLine);
        }
    }

    return processed
        .join('\n\n') // Paragraphs separated by double newlines
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
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
        const digitalText = execSync(`pdftotext -f ${pageNum} -l ${pageNum} "${pdfPath}" -`, {
            encoding: 'utf8'
        }).trim();

        if (digitalText && digitalText.length > 50) return smartClean(digitalText);

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
        if (book.status === 'processing_pages') return res.status(429).json({ error: "Processing..." });

        const startPage = (book.processedPages || 0) + 1;
        const endPage = Math.min(startPage + 4, book.totalPages);
        if (startPage > book.totalPages) return res.json({ addedText: "", status: "completed" });

        await Book.findByIdAndUpdate(req.params.id, { status: 'processing_pages' });
        tempPath = path.join(pdfDir, `temp_load_${book._id}.pdf`);

        if (!(await fs.pathExists(tempPath))) {
            const response = await axios.get(book.pdfPath, { responseType: 'arraybuffer' });
            fs.writeFileSync(tempPath, Buffer.from(response.data));
        }

        let newTextParts = [];
        let newTOCEntries = [];
        for (let i = startPage; i <= endPage; i++) {
            const text = await extractPageText(tempPath, i);
            if (text) {
                newTextParts.push(`[PAGE_${i}]\n${text}`);
                if (i < 15) {
                    const found = extractTOC(text);
                    if (found.length > 0) newTOCEntries.push(...found);
                }
            }
        }

        const newText = newTextParts.join("\n\n");
        const updatedContent = (book.content || "").trim() ? (book.content.trim() + "\n\n" + newText) : newText;
        const mergedTOC = [...(book.toc || []), ...newTOCEntries].filter((v, i, a) =>
            a.findIndex(t => (t.text === v.text && t.page === v.page)) === i
        );

        const updatedBook = await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent,
            processedPages: endPage,
            status: endPage >= book.totalPages ? 'completed' : 'processing',
            words: updatedContent.split(/\s+/).filter(w => w.length > 0).length,
            toc: mergedTOC
        }, { new: true });

        res.json({ addedText: newText, processedPages: endPage, status: updatedBook.status, toc: mergedTOC });
    } catch (err) {
        await Book.findByIdAndUpdate(req.params.id, { status: 'processing' });
        res.status(500).json({ error: "Lazy load failed" });
    }
});

router.post("/", protect, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });
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
                        runningText += (runningText ? "\n\n" : "") + `[PAGE_${i}]\n` + text;
                        if (i < 15) runningTOC.push(...extractTOC(text));
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

router.delete("/:id", protect, async (req, res) => {
    try {
        const book = await Book.findOne({ _id: req.params.id, user: req.user._id });
        if (!book) return res.status(404).json({ error: "Book not found" });

        if (book.pdfPath?.includes("cloudinary")) {
            const pdfId = `storyteller_pdfs/${path.parse(book.pdfPath).name}`;
            await cloudinary.uploader.destroy(pdfId, { resource_type: 'raw' });
        }
        if (book.cover?.includes("cloudinary")) {
            const coverId = `storyteller_covers/${path.parse(book.cover).name}`;
            await cloudinary.uploader.destroy(coverId);
        }

        const tempPdf = path.join(pdfDir, `temp_load_${book._id}.pdf`);
        if (await fs.pathExists(tempPdf)) await fs.remove(tempPdf);

        await Book.findByIdAndDelete(req.params.id);
        res.json({ message: "Book deleted" });
    } catch (err) { res.status(500).json({ error: "Delete failed" }); }
});

module.exports = router;