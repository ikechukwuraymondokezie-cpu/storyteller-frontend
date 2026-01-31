const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const Book = require("../models/Book");

const router = express.Router();

/* ---------------- MULTER CONFIG ---------------- */
const uploadsRoot = path.join(__dirname, "../uploads");        // backend uploads folder
const pdfDir = path.join(uploadsRoot, "pdf");
const coversDir = path.join(uploadsRoot, "covers");
const audioDir = path.join(uploadsRoot, "audio");

// Ensure folders exist
fs.ensureDirSync(pdfDir);
fs.ensureDirSync(coversDir);
fs.ensureDirSync(audioDir);

const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, pdfDir),
    filename: (_, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

/* ---------------- GET ALL BOOKS ---------------- */
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

/* ---------------- GET BOOKS BY FOLDER ---------------- */
router.get("/folder/:folder", async (req, res) => {
    try {
        const books = await Book.find({ folder: req.params.folder }).sort({ createdAt: -1 });
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

/* ---------------- UPLOAD BOOK + GENERATE COVER ---------------- */
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const baseName = path.parse(req.file.filename).name;
        const pdfPublicPath = `/uploads/pdf/${req.file.filename}`;
        const coverDiskPath = path.join(coversDir, `${baseName}-1.png`);
        const coverPublicPath = `/uploads/covers/${baseName}-1.png`;

        // Generate cover (first page)
        exec(
            `pdftoppm -f 1 -l 1 -png "${path.join(pdfDir, req.file.filename)}" "${path.join(coversDir, baseName)}"`,
            async (error) => {
                if (error) console.warn("⚠️ Cover generation failed:", error.message);

                const book = await Book.create({
                    title: req.file.originalname.replace(/\.[^/.]+$/, ""),
                    pdfPath: pdfPublicPath,
                    cover: fs.existsSync(coverDiskPath) ? coverPublicPath : null,
                    folder: "default",
                    downloads: 0,
                    ttsRequests: 0,
                });

                res.status(201).json({
                    _id: book._id,
                    title: book.title,
                    cover: book.cover || null,
                    url: book.pdfPath,
                    folder: book.folder,
                    downloads: book.downloads,
                    ttsRequests: book.ttsRequests,
                });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed" });
    }
});

/* ---------------- PATCH ACTIONS ---------------- */
router.patch("/:id/actions", async (req, res) => {
    try {
        const { action } = req.body;
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        if (action === "download") book.downloads += 1;
        if (action === "tts") book.ttsRequests += 1;

        await book.save();

        res.json({
            _id: book._id,
            title: book.title,
            cover: book.cover || null,
            url: book.pdfPath,
            folder: book.folder,
            downloads: book.downloads,
            ttsRequests: book.ttsRequests,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Action failed" });
    }
});

module.exports = router;
