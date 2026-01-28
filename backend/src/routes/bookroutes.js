// storyteller-backend/src/routes/books.routes.js

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { PDFImage } = require("pdf-poppler");
const Book = require("../models/Book");

const router = express.Router();

/* =========================
   MULTER CONFIG
========================= */
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

/* =========================
   GET ALL BOOKS
========================= */
router.get("/", async (req, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        const mapped = books.map((b) => ({
            _id: b._id,
            title: b.title,
            cover: b.cover || null,
            url: b.pdfPath,
            folder: b.folder || "default",
            downloads: b.downloads,
            ttsRequests: b.ttsRequests,
        }));
        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

/* =========================
   GET BOOKS BY FOLDER
========================= */
router.get("/folder/:folder", async (req, res) => {
    try {
        const books = await Book.find({ folder: req.params.folder }).sort({
            createdAt: -1,
        });

        const mapped = books.map((b) => ({
            _id: b._id,
            title: b.title,
            cover: b.cover || null,
            url: b.pdfPath,
            folder: b.folder,
            downloads: b.downloads,
            ttsRequests: b.ttsRequests,
        }));

        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch folder books" });
    }
});

/* =========================
   UPLOAD BOOK + PDF THUMBNAIL
========================= */
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const pdfPath = path.join("uploads", req.file.filename);

        // Generate thumbnail (first page) using pdf-poppler
        let coverPath = null;
        try {
            const outputDir = "uploads/covers";
            await fs.ensureDir(outputDir);

            const opts = {
                format: "png",
                out_dir: outputDir,
                out_prefix: path.parse(req.file.filename).name,
                page: 1,
            };

            await PDFImage.convert(pdfPath, opts);

            coverPath = `/uploads/covers/${opts.out_prefix}-1.png`;
        } catch (thumbErr) {
            console.warn("❌ Failed to generate PDF cover:", thumbErr);
        }

        const book = await Book.create({
            title: req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: `/${pdfPath}`,
            cover: coverPath,
            folder: "default",
            downloads: 0,
            ttsRequests: 0,
        });

        const mapped = {
            _id: book._id,
            title: book.title,
            cover: book.cover || null,
            url: book.pdfPath,
            folder: book.folder,
            downloads: book.downloads,
            ttsRequests: book.ttsRequests,
        };

        res.status(201).json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed" });
    }
});

/* =========================
   PATCH ACTIONS
========================= */
router.patch("/:id/actions", async (req, res) => {
    try {
        const { action } = req.body;
        const book = await Book.findById(req.params.id);

        if (!book) return res.status(404).json({ error: "Book not found" });

        if (action === "download") book.downloads += 1;
        if (action === "tts") book.ttsRequests += 1;

        await book.save();

        const mapped = {
            _id: book._id,
            title: book.title,
            cover: book.cover || null,
            url: book.pdfPath,
            folder: book.folder,
            downloads: book.downloads,
            ttsRequests: book.ttsRequests,
        };

        res.json(mapped);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Action failed" });
    }
});

module.exports = router;
