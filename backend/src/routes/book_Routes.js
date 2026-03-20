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
        const allowedMimes = [
            "application/pdf",
            "application/octet-stream",
            "binary/octet-stream"
        ];
        const isPdf = allowedMimes.includes(file.mimetype) ||
            file.originalname.toLowerCase().endsWith('.pdf');
        if (isPdf) cb(null, true);
        else cb(new Error("Only PDF files are allowed"), false);
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

/**
 * Extracts the Cloudinary public_id from a full Cloudinary URL.
 */
function getCloudinaryPublicId(url) {
    try {
        const uploadIndex = url.indexOf('/upload/');
        if (uploadIndex === -1) return null;
        let afterUpload = url.substring(uploadIndex + 8);
        afterUpload = afterUpload.replace(/^v\d+\//, '');
        return afterUpload;
    } catch {
        return null;
    }
}

/* ---------------- TOC & TEXT CLEANING HELPERS ---------------- */

function isUsableText(text) {
    if (!text || text.trim().length < 50) return false;
    const words = text.trim().split(/\s+/);
    const realWords = words.filter(w => /[a-zA-Z]{3,}/.test(w));
    if (realWords.length < 15) return false;
    return (realWords.length / words.length) > 0.4;
}

function isHeaderLine(line) {
    const t = line.trim();
    if (!t) return false;
    if (t === t.toUpperCase() && /[A-Z]/.test(t) && !/\d/.test(t) && t.length < 120) return true;
    if (/^(Chapter|Section|Part|Lesson|Psalm|Act|Scene|Preface|Foreword|Introduction|Epilogue|Appendix|Prologue|Conclusion|Afterword|Unit|Module|Volume|Book|Verse)\s*(\d+|[IVXLCDM]+)?/i.test(t)) return true;
    if (/^([IVXLCDM]+\.|\d+[\.\:])\s+[A-Z]/.test(t)) return true;
    return false;
}

function extractTOC(text, pageNum) {
    const isTOCPage = /contents|table of contents/i.test(text);
    if (!isTOCPage) return [];

    const tocEntries = [];
    const tocRegex = /^(.+?)\s*[.\-·_ ]{2,}\s*(\d+)\s*$/gim;

    let match;
    while ((match = tocRegex.exec(text)) !== null) {
        const raw = match[1].trim();
        const page = parseInt(match[2]);
        if (!raw || raw.length < 2 || /^(page|contents)$/i.test(raw)) continue;

        let level = 1;
        if (/^\d+\.\d+\.\d+/.test(raw)) level = 2;
        else if (/^\d+\.\d+/.test(raw)) level = 1;
        else if (/^(chapter|part|unit|lesson|act|psalm|book)\s+(\d+|[ivxlc]+)/i.test(raw)) level = 0;
        else if (/^\d+\.?\s+[A-Z]/.test(raw)) level = 0;
        else if (/^[A-Z\s]{4,}$/.test(raw)) level = 0;

        tocEntries.push({ text: raw, page, level, type: 'toc' });
    }

    return tocEntries;
}

/**
 * Cleans pdftotext output using median line length to detect border wraps.
 *
 * Border detection logic for pdftotext path:
 * - Calculate median line length for the page (represents full-width body lines)
 * - A line shorter than 85% of median AND not ending with .!? = border wrap → join
 * - A line at/near median length not ending with .!? = intentional break → keep
 * - Headers always stay isolated regardless of length
 *
 * This is the pdftotext equivalent of the OCR x_end coordinate detection.
 */
function smartClean(text) {
    if (!text) return "";

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) return "";

    // ---- Calculate median line length for border detection ----
    const lengths = lines.map(l => l.length).sort((a, b) => a - b);
    const medianLength = lengths[Math.floor(lengths.length / 2)];

    /**
     * Returns true if a line appears to be a border wrap.
     * A border wrap is a line that:
     * - Is shorter than 85% of the median line length (didn't reach the right margin)
     * - Does NOT end with sentence-ending punctuation
     * - Is NOT a header (headers are intentionally short)
     */
    const isBorderWrap = (line) => {
        if (/[.!?]['""\)\]»]?$/.test(line)) return false; // ends a sentence
        if (isHeaderLine(line)) return false;               // header
        return line.length < medianLength * 0.85;           // shorter than typical line
    };

    const result = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const next = i + 1 < lines.length ? lines[i + 1] : null;

        // Fix hyphenated word break across lines
        if (/\w-$/.test(line) && next && /^\w/.test(next) && !isHeaderLine(next)) {
            result.push(line.replace(/-$/, '') + next);
            i++;
            continue;
        }

        // Headers always stay isolated with blank lines around them
        if (isHeaderLine(line)) {
            if (result.length > 0 && result[result.length - 1] !== '') result.push('');
            result.push(line);
            if (next) result.push('');
            continue;
        }

        const isRealEnd = /[.!?]['""\)\]»]?$/.test(line);
        const nextIsHeader = next && isHeaderLine(next);

        if (!next || isRealEnd || nextIsHeader) {
            // Definite paragraph end — keep as-is
            result.push(line);
        } else if (isBorderWrap(line)) {
            // Short line that didn't reach the margin = border wrap → join
            result.push(line + ' ');
        } else {
            // Full-width line without sentence ending
            // Could be intentional (poetry, dialogue, lists) — keep separate
            result.push(line);
        }
    }

    return result
        .join('\n')
        .replace(/[ \t]+/g, ' ')
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
        const { stdout: digitalText } = await execAsync(
            `pdftotext -f ${pageNum} -l ${pageNum} "${pdfPath}" -`,
            { encoding: 'utf8' }
        );

        if (isUsableText(digitalText)) {
            return smartClean(digitalText.trim());
        }

        await execAsync(
            `pdftoppm -f ${pageNum} -l ${pageNum} -png -r 300 -singlefile "${pdfPath}" "${pageImgBase}"`
        );

        if (!(await fs.pathExists(pageImgFull))) {
            console.warn(`pdftoppm produced no output for page ${pageNum}`);
            return "";
        }

        const scriptPath = path.join(__dirname, "../ocr_worker/ocr_service.py");
        const { stdout: ocrResult, stderr: ocrStderr } = await execAsync(
            `python3 "${scriptPath}" "${pageImgFull}"`,
            { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }
        );

        if (ocrStderr && ocrStderr.includes("RuntimeError")) {
            console.error(`OCR Python error on page ${pageNum}:`, ocrStderr.trim());
            if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
            return "";
        }

        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
        return ocrResult; // OCR already handled border detection internally

    } catch (e) {
        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
        console.warn(`extractPageText failed for page ${pageNum}:`, e.message);
        return "";
    }
}

/* ---------------- ROUTES ---------------- */

router.get("/continue", protect, async (req, res) => {
    try {
        const book = await Book.findOne({ user: req.user._id }).sort({ lastAccessed: -1 }).limit(1);
        if (!book) return res.json(null);
        res.json(formatBook(book));
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch continue book" });
    }
});

router.get("/", protect, async (req, res) => {
    try {
        const books = await Book.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(books.map(formatBook));
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch library" });
    }
});

// FOLDER ROUTES — must be before /:id
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

// MOVE BOOK TO FOLDER
router.patch("/:id/folder", protect, async (req, res) => {
    try {
        const { folder } = req.body;
        if (!folder) return res.status(400).json({ error: "Folder name required" });
        const book = await Book.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { folder },
            { new: true }
        );
        if (!book) return res.status(404).json({ error: "Book not found" });
        res.json(formatBook(book));
    } catch (err) {
        res.status(500).json({ error: "Failed to move book" });
    }
});

router.get("/:id/load-pages", protect, async (req, res) => {
    let tempPath = "";
    try {
        const book = await Book.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.user._id,
                status: { $nin: ['processing_pages', 'completed'] }
            },
            { status: 'processing_pages' },
            { new: false }
        );

        if (!book) {
            const current = await Book.findOne({ _id: req.params.id, user: req.user._id });
            if (!current) return res.status(404).json({ error: "Book not found" });
            if (current.status === 'completed') return res.json({ addedText: "", status: "completed" });
            return res.status(429).json({ error: "Processing. Please wait." });
        }

        const startPage = (book.processedPages || 0) + 1;
        const endPage = Math.min(startPage + 4, book.totalPages);

        if (startPage > book.totalPages) return res.json({ addedText: "", status: "completed" });

        tempPath = path.join(pdfDir, `temp_load_${book._id}.pdf`);

        if (await fs.pathExists(tempPath)) {
            const stat = await fs.stat(tempPath);
            if (stat.size < 1024) {
                console.warn(`Cached temp PDF is corrupt (${stat.size} bytes), re-downloading`);
                await fs.remove(tempPath);
            }
        }

        if (!(await fs.pathExists(tempPath))) {
            const response = await axios.get(book.pdfPath, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            const buffer = Buffer.from(response.data);
            if (buffer.length < 1024) {
                throw new Error(`Downloaded PDF too small (${buffer.length} bytes)`);
            }
            await fs.writeFile(tempPath, buffer);
        }

        let newTextParts = [];
        let newTOCEntries = [];

        for (let i = startPage; i <= endPage; i++) {
            const text = await extractPageText(tempPath, i);
            if (text) {
                newTextParts.push(`[PAGE_${i}]\n${text}`);
                if ((!book.toc || book.toc.length === 0) && i <= 10) {
                    newTOCEntries.push(...extractTOC(text, i));
                }
            }
        }

        const newText = newTextParts.join("\n\n");
        const currentContent = (book.content || "").trim();
        const updatedContent = currentContent ? (currentContent + "\n\n" + newText) : newText;
        const actualWordCount = updatedContent.split(/\s+/).filter(w => w.length > 0).length;

        const mergedTOC = [...(book.toc || []), ...newTOCEntries].filter((v, i, a) =>
            a.findIndex(t => t.text === v.text && t.page === v.page) === i
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
                        exec(`pdftoppm -f 1 -l 1 -png -r 150 -singlefile "${pdfDiskPath}" "${outputPrefix}"`, async (err, stdout, stderr) => {
                            if (err) { console.warn("Cover generation failed:", stderr); return resolve(null); }
                            const coverFile = `${outputPrefix}.png`;
                            if (!(await fs.pathExists(coverFile))) { console.warn("Cover PNG not found"); return resolve(null); }
                            try {
                                const r = await cloudinary.uploader.upload(coverFile, { folder: "storyteller_covers" });
                                await fs.remove(coverFile);
                                resolve(r.secure_url);
                            } catch (uploadErr) {
                                console.warn("Cover upload failed:", uploadErr.message);
                                if (await fs.pathExists(coverFile)) await fs.remove(coverFile);
                                resolve(null);
                            }
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
                        if (i <= 10) runningTOC.push(...extractTOC(text, i));
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
                await Book.findByIdAndUpdate(book._id, { status: 'failed' });
                if (await fs.pathExists(pdfDiskPath)) await fs.remove(pdfDiskPath);
            }
        })();

    } catch (err) {
        res.status(500).json({ error: "Upload failed" });
    }
});

// DELETE BOOK
router.delete("/:id", protect, async (req, res) => {
    try {
        const book = await Book.findOne({ _id: req.params.id, user: req.user._id });
        if (!book) return res.status(404).json({ error: "Book not found" });

        try {
            if (book.pdfPath && book.pdfPath.includes("cloudinary")) {
                const pdfPublicId = getCloudinaryPublicId(book.pdfPath);
                if (pdfPublicId) {
                    await cloudinary.uploader.destroy(pdfPublicId, { resource_type: 'raw' });
                }
            }
            if (book.cover && book.cover.includes("cloudinary")) {
                const coverPublicId = getCloudinaryPublicId(book.cover);
                if (coverPublicId) {
                    await cloudinary.uploader.destroy(coverPublicId);
                }
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