const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;

// Standard require to avoid export errors
const pdf = require("pdf-parse");
const Tesseract = require("tesseract.js");

const Book = require("../models/Book");
const Folder = require("../models/Folder");

const router = express.Router();

/* ---------------- CLOUDINARY CONFIG ---------------- */
cloudinary.config();

/* ---------------- STORAGE CONFIG ---------------- */
const uploadsRoot = path.join(__dirname, "../uploads");
const pdfDir = path.join(uploadsRoot, "pdfs");
const coversDir = path.join(uploadsRoot, "covers");

fs.ensureDirSync(pdfDir);
fs.ensureDirSync(coversDir);

const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, pdfDir),
    filename: (_, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // Support up to 100MB
});

/* ---------------- HELPERS ---------------- */
const deleteFiles = async (book) => {
    try {
        if (book.pdfPath && !book.pdfPath.startsWith('http')) {
            const p = path.join(__dirname, "..", book.pdfPath);
            if (await fs.pathExists(p)) await fs.remove(p);
        }
    } catch (err) {
        console.error("File deletion error:", err);
    }
};

// Helper for fast per-page OCR
async function extractPageText(pdfPath, pageNum) {
    const pageImg = path.join(coversDir, `tmp_${pageNum}_${Date.now()}.png`);
    try {
        await new Promise((resolve, reject) => {
            exec(`pdftoppm -f ${pageNum} -l ${pageNum} -png -singlefile "${pdfPath}" "${pageImg.replace('.png', '')}"`, (err) => {
                if (err) reject(err); else resolve();
            });
        });
        const { data: { text } } = await Tesseract.recognize(pageImg, 'eng');
        if (await fs.pathExists(pageImg)) await fs.remove(pageImg);
        return text;
    } catch (e) {
        console.error(`Error OCRing page ${pageNum}:`, e);
        return "";
    }
}

// Background Worker to handle pages 11 to END
async function processRemainingPages(bookId, pdfPath, startPage, totalPages) {
    console.log(`🌀 Background OCR: Pages ${startPage} to ${totalPages}`);
    try {
        const book = await Book.findById(bookId);
        let fullContent = book.content;

        for (let i = startPage; i <= totalPages; i++) {
            const pageText = await extractPageText(pdfPath, i);
            fullContent += "\n" + pageText;

            // Update database every 5 pages to show progress and save state
            if (i % 5 === 0 || i === totalPages) {
                await Book.findByIdAndUpdate(bookId, {
                    content: fullContent,
                    processedPages: i,
                    words: fullContent.split(/\s+/).filter(w => w.length > 0).length,
                    status: i === totalPages ? 'completed' : 'processing'
                });
            }
        }
        // Final cleanup of the local PDF after full processing
        if (await fs.pathExists(pdfPath)) await fs.remove(pdfPath);
        console.log(`✅ Background OCR Complete for Book: ${bookId}`);
    } catch (err) {
        console.error("❌ Background Worker Error:", err);
    }
}

/* ---------------- FOLDER ROUTES ---------------- */
router.get("/folders", async (_, res) => {
    try {
        const folders = await Folder.find().sort({ name: 1 });
        res.json(["All", ...folders.map(f => f.name)]);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch folders" });
    }
});

router.post("/folders", async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name === "All") return res.status(400).json({ error: "Invalid name" });
        const existing = await Folder.findOne({ name });
        if (existing) return res.status(400).json({ error: "Exists" });
        const folder = await Folder.create({ name });
        res.status(201).json(folder);
    } catch (err) {
        res.status(500).json({ error: "Create folder failed" });
    }
});

/* ---------------- BOOK ROUTES ---------------- */

router.get("/", async (_, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch book" });
    }
});

/**
 * UPLOAD BOOK: 10-Page Instant Extraction + TOC + Background Worker
 */
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        const folderName = req.body.folder || "All";
        const pdfDiskPath = req.file.path;
        const baseName = path.parse(req.file.filename).name;
        const outputPrefix = path.join(coversDir, baseName);
        const tempLocalCoverPath = `${outputPrefix}.png`;

        // 1. Get Meta Info (Total Pages)
        const dataBuffer = await fs.readFile(pdfDiskPath);
        const meta = await pdf(dataBuffer);
        const totalPages = meta.numpages;

        // 2. Generate Thumbnail & Upload PDF in Parallel
        const generateCover = () => new Promise((resolve) => {
            exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfDiskPath}" "${outputPrefix}"`, async (error) => {
                if (error) return resolve(null);
                try {
                    const uploadRes = await cloudinary.uploader.upload(tempLocalCoverPath, { folder: "storyteller_covers" });
                    if (await fs.pathExists(tempLocalCoverPath)) await fs.remove(tempLocalCoverPath);
                    resolve(uploadRes.secure_url);
                } catch { resolve(null); }
            });
        });

        const uploadPdfToCloud = async () => {
            const result = await cloudinary.uploader.upload(pdfDiskPath, {
                folder: "storyteller_pdfs",
                resource_type: "raw",
                public_id: `${Date.now()}-${req.file.originalname}`
            });
            return result.secure_url;
        };

        const [coverUrl, cloudPdfUrl] = await Promise.all([generateCover(), uploadPdfToCloud()]);

        // 3. INSTANT PHASE: Parallel OCR for first 10 pages
        const instantLimit = Math.min(10, totalPages);
        const pagePromises = [];
        for (let i = 1; i <= instantLimit; i++) {
            pagePromises.push(extractPageText(pdfDiskPath, i));
        }
        const pageResults = await Promise.all(pagePromises);
        const initialText = pageResults.join("\n");

        // 4. INSTANT TOC GENERATION (Regex based on Page 1-10 text)
        const tocEntries = [];
        initialText.split('\n').forEach(line => {
            const tocMatch = line.match(/^(.*?)(?:\.{2,}|…|\s{2,})(\d+)$/);
            if (tocMatch) tocEntries.push({ title: tocMatch[1].trim(), page: parseInt(tocMatch[2]) });
        });

        // 5. Create Database Entry
        const book = await Book.create({
            title: req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: cloudPdfUrl,
            cover: coverUrl,
            folder: folderName,
            content: initialText,
            chapters: tocEntries,
            totalPages: totalPages,
            processedPages: instantLimit,
            status: totalPages <= 10 ? 'completed' : 'processing',
            words: initialText.split(/\s+/).filter(w => w.length > 0).length
        });

        // 6. Start Background Worker for the rest of the book
        if (totalPages > 10) {
            processRemainingPages(book._id, pdfDiskPath, 11, totalPages);
        } else {
            // Cleanup local file immediately if book is small
            if (await fs.pathExists(pdfDiskPath)) await fs.remove(pdfDiskPath);
        }

        res.status(201).json(book);

    } catch (err) {
        console.error("Upload error:", err);
        if (req.file && await fs.pathExists(req.file.path)) await fs.remove(req.file.path);
        res.status(500).json({ error: "Upload failed" });
    }
});

/* ---------------- REMAINING ROUTES ---------------- */

router.patch("/:id/rename", async (req, res) => {
    try {
        const { title } = req.body;
        const book = await Book.findByIdAndUpdate(req.params.id, { title }, { new: true });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: "Rename failed" });
    }
});

router.patch("/:id/move", async (req, res) => {
    try {
        const { folder } = req.body;
        const book = await Book.findByIdAndUpdate(req.params.id, { folder: folder || "All" }, { new: true });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: "Move failed" });
    }
});

router.post("/bulk-delete", async (req, res) => {
    try {
        const { ids } = req.body;
        const books = await Book.find({ _id: { $in: ids } });
        for (const book of books) { await deleteFiles(book); }
        await Book.deleteMany({ _id: { $in: ids } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Bulk delete failed" });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (book) {
            await deleteFiles(book);
            await book.deleteOne();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

router.patch("/:id/actions", async (req, res) => {
    try {
        const { action } = req.body;
        const update = action === "download" ? { $inc: { downloads: 1 } } : { $inc: { ttsRequests: 1 } };
        const book = await Book.findByIdAndUpdate(req.params.id, update, { new: true });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: "Action failed" });
    }
});

module.exports = router;