const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;
const Book = require("../models/Book");
const Folder = require("../models/Folder");

const router = express.Router();

/* ---------------- CLOUDINARY CONFIG ---------------- */
cloudinary.config();

/* ---------------- STORAGE CONFIG ---------------- */
const uploadsRoot = path.join(__dirname, "../uploads");
const pdfDir = path.join(uploadsRoot, "pdfs");
const coversDir = path.join(uploadsRoot, "covers");
const audioDir = path.join(uploadsRoot, "audio");

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
        // Only try to delete local files if they aren't Cloudinary URLs
        if (book.pdfPath && !book.pdfPath.startsWith('http')) {
            const p = path.join(__dirname, "..", book.pdfPath);
            if (await fs.pathExists(p)) await fs.remove(p);
        }
    } catch (err) {
        console.error("File deletion error:", err);
    }
};

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

// GET ALL BOOKS
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
            ttsRequests: b.ttsRequests || 0,
            createdAt: b.createdAt
        })));
    } catch (err) {
        res.status(500).json({ error: "Fetch failed" });
    }
});

// GET SINGLE BOOK
router.get("/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });
        res.json({
            _id: book._id,
            title: book.title,
            cover: book.cover,
            url: book.pdfPath,
            folder: book.folder || "All",
            downloads: book.downloads || 0,
            ttsRequests: book.ttsRequests || 0
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch book details" });
    }
});

router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        const folderName = req.body.folder || "All";
        const baseName = path.parse(req.file.filename).name;
        const pdfDiskPath = req.file.path;
        const outputPrefix = path.join(coversDir, baseName);
        const tempLocalCoverPath = `${outputPrefix}.png`;

        // 1. Generate Cover from local PDF
        const generateCover = () => new Promise((resolve) => {
            exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfDiskPath}" "${outputPrefix}"`, async (error) => {
                if (error) {
                    console.error("pdftoppm error:", error);
                    return resolve(null);
                }
                try {
                    const uploadRes = await cloudinary.uploader.upload(tempLocalCoverPath, {
                        folder: "storyteller_covers"
                    });
                    if (fs.existsSync(tempLocalCoverPath)) await fs.remove(tempLocalCoverPath);
                    resolve(uploadRes.secure_url);
                } catch (cloudErr) {
                    console.error("Cloudinary Cover Error:", cloudErr);
                    resolve(null);
                }
            });
        });

        // 2. Upload PDF to Cloudinary as 'raw'
        const uploadPdfToCloud = async () => {
            const result = await cloudinary.uploader.upload(pdfDiskPath, {
                folder: "storyteller_pdfs",
                resource_type: "raw",
                public_id: `${Date.now()}-${req.file.originalname}`
            });
            return result.secure_url;
        };

        // Run uploads in parallel
        const [coverUrl, cloudPdfUrl] = await Promise.all([generateCover(), uploadPdfToCloud()]);

        // 3. Save to Database with the Cloudinary URL
        const book = await Book.create({
            title: req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: cloudPdfUrl,
            cover: coverUrl,
            folder: folderName,
        });

        // 4. CLEAN UP: Delete the local PDF so Render doesn't wipe it later
        if (fs.existsSync(pdfDiskPath)) await fs.remove(pdfDiskPath);

        res.status(201).json(book);
    } catch (err) {
        console.error("Upload error:", err);
        if (req.file && fs.existsSync(req.file.path)) await fs.remove(req.file.path);
        res.status(500).json({ error: "Upload failed" });
    }
});

router.patch("/:id/rename", async (req, res) => {
    try {
        const { title } = req.body;
        if (!title) return res.status(400).json({ error: "Title is required" });
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
        for (const book of books) {
            await deleteFiles(book);
        }
        await Book.deleteMany({ _id: { $in: ids } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Bulk delete failed" });
    }
});

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