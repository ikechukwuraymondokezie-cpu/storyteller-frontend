const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { spawn } = require("child_process");
const Book = require("../models/Book");
const Folder = require("../models/Folder");

const router = express.Router();

/* ---------------- STORAGE CONFIG ---------------- */
const uploadsRoot = path.join(__dirname, "../uploads");
const pdfDir = path.join(uploadsRoot, "pdf");
const coversDir = path.join(uploadsRoot, "covers");
const audioDir = path.join(uploadsRoot, "audio");

// Ensure physical directories exist
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

/* ---------------- HELPERS ---------------- */
const deleteFiles = async (book) => {
    try {
        if (book.pdfPath) {
            const p = path.join(__dirname, "..", book.pdfPath);
            if (await fs.pathExists(p)) await fs.remove(p);
        }
        if (book.cover) {
            const c = path.join(__dirname, "..", book.cover);
            if (await fs.pathExists(c)) await fs.remove(c);
        }
    } catch (err) {
        console.error("File deletion error:", err);
    }
};

/* ---------------- FOLDER ROUTES ---------------- */

// Get folder names for the frontend tabs
router.get("/folders", async (_, res) => {
    try {
        const folders = await Folder.find().sort({ name: 1 });
        // The frontend expects ["All", "Folder1", "Folder2"]
        res.json(["All", ...folders.map(f => f.name)]);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch folders" });
    }
});

// Create folder in DB
router.post("/folders", async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Name required" });

        const existing = await Folder.findOne({ name });
        if (existing) return res.status(400).json({ error: "Exists" });

        const folder = await Folder.create({ name });
        res.status(201).json(folder);
    } catch (err) {
        res.status(500).json({ error: "Create folder failed" });
    }
});

/* ---------------- BOOK ROUTES ---------------- */

// Get all books
router.get("/", async (_, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books.map(b => ({
            _id: b._id,
            title: b.title,
            cover: b.cover,
            url: b.pdfPath,
            folder: b.folder || "All",
            downloads: b.downloads || 0,
            ttsRequests: b.ttsRequests || 0
        })));
    } catch (err) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

// Upload Book + Thumbnail
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        const folderName = req.body.folder || "All";
        const baseName = path.parse(req.file.filename).name;
        const pdfDiskPath = req.file.path;

        // Cover generation promise
        const generateCover = () => new Promise((resolve) => {
            const proc = spawn("pdftoppm", [
                "-f", "1", "-l", "1", "-png", "-singlefile",
                pdfDiskPath, path.join(coversDir, baseName)
            ]);
            proc.on("close", () => {
                const coverPath = path.join(coversDir, `${baseName}.png`);
                resolve(fs.existsSync(coverPath) ? `/uploads/covers/${baseName}.png` : null);
            });
            proc.on("error", () => resolve(null));
        });

        const coverPath = await generateCover();

        const book = await Book.create({
            title: req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: `/uploads/pdf/${req.file.filename}`,
            cover: coverPath,
            folder: folderName,
        });

        res.status(201).json(book);
    } catch (err) {
        res.status(500).json({ error: "Upload failed" });
    }
});

// Bulk Delete
router.post("/bulk-delete", async (req, res) => {
    try {
        const { ids } = req.body;
        const books = await Book.find({ _id: { $in: ids } });
        for (const book of books) {
            await deleteFiles(book);
        }
        await Book.deleteMany({ _id: { $in: ids } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Bulk delete failed" });
    }
});

// Single Delete
router.delete("/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Not found" });
        await deleteFiles(book);
        await book.deleteOne();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// Move book
router.patch("/:id/move", async (req, res) => {
    try {
        const { folderName } = req.body;
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { folder: folderName || "All" },
            { new: true }
        );
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: "Move failed" });
    }
});

// Stats updates
router.patch("/:id/actions", async (req, res) => {
    try {
        const { action } = req.body;
        const update = {};
        if (action === "download") update.$inc = { downloads: 1 };
        if (action === "tts") update.$inc = { ttsRequests: 1 };

        const book = await Book.findByIdAndUpdate(req.params.id, update, { new: true });
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: "Action failed" });
    }
});

module.exports = router;