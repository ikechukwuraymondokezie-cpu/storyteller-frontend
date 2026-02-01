const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { spawn } = require("child_process");
const Book = require("../models/Book");
const Folder = require("../models/Folder"); // Folder model

const router = express.Router();

/* ---------------- MULTER CONFIG ---------------- */
const uploadsRoot = path.join(__dirname, "../uploads");
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

/* ---------------- FOLDER ROUTES ---------------- */

// Get all folders from DB
router.get("/folders", async (_, res) => {
    try {
        const folders = await Folder.find().sort({ name: 1 });
        res.json(["All", ...folders.map(f => f.name)]);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch folders" });
    }
});

// Create a new folder in DB
router.post("/folders", async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Folder name required" });

        const existing = await Folder.findOne({ name });
        if (existing) return res.status(400).json({ error: "Folder already exists" });

        const folder = await Folder.create({ name });
        res.status(201).json(folder);
    } catch (err) {
        res.status(500).json({ error: "Failed to create folder" });
    }
});

/* ---------------- GET ALL BOOKS ---------------- */
router.get("/", async (_, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(
            books.map((b) => ({
                _id: b._id,
                title: b.title,
                cover: b.cover || null,
                url: b.pdfPath,
                folder: b.folder || "All",
                downloads: b.downloads,
                ttsRequests: b.ttsRequests,
            }))
        );
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

/* ---------------- UPLOAD BOOK + GENERATE COVER ---------------- */
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        let folderName = req.body.folder || "All";
        if (folderName !== "All") {
            let folder = await Folder.findOne({ name: folderName });
            if (!folder) folder = await Folder.create({ name: folderName });
        }

        const baseName = path.parse(req.file.filename).name;
        const pdfDiskPath = path.join(pdfDir, req.file.filename);
        const pdfPublicPath = `/uploads/pdf/${req.file.filename}`;

        const generateCover = () =>
            new Promise((resolve) => {
                const proc = spawn("pdftoppm", [
                    "-f", "1",
                    "-l", "1",
                    "-png",
                    "-singlefile",
                    pdfDiskPath,
                    path.join(coversDir, baseName)
                ]);

                proc.on("close", (code) => {
                    const coverPath = path.join(coversDir, `${baseName}.png`);
                    resolve(fs.existsSync(coverPath) ? `/uploads/covers/${baseName}.png` : null);
                });

                proc.on("error", (err) => {
                    console.error("❌ pdftoppm error:", err);
                    resolve(null);
                });
            });

        const coverPath = await generateCover();

        const book = await Book.create({
            title: req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: pdfPublicPath,
            cover: coverPath,
            folder: folderName,
            downloads: 0,
            ttsRequests: 0,
        });

        res.status(201).json(book);

    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

/* ---------------- PATCH ACTIONS ---------------- */

// Move book to folder
router.patch("/:id/move", async (req, res) => {
    try {
        const { folderName } = req.body;
        if (folderName !== "All") {
            const folder = await Folder.findOne({ name: folderName });
            if (!folder) return res.status(400).json({ error: "Folder does not exist" });
        }

        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { folder: folderName || "All" },
            { new: true }
        );

        if (!book) return res.status(404).json({ error: "Book not found" });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: "Failed to move book" });
    }
});

// Download / TTS counters
router.patch("/:id/actions", async (req, res) => {
    try {
        const { action } = req.body;
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        if (action === "download") book.downloads += 1;
        if (action === "tts") book.ttsRequests += 1;

        await book.save();
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: "Action failed" });
    }
});

module.exports = router;
