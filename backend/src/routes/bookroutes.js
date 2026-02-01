const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { spawn } = require("child_process");
const Book = require("../models/Book");

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
                folder: b.folder || "default",
                downloads: b.downloads,
                ttsRequests: b.ttsRequests,
            }))
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

/* ---------------- UPLOAD BOOK + GENERATE COVER ---------------- */
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const baseName = path.parse(req.file.filename).name;
        const pdfDiskPath = path.join(pdfDir, req.file.filename);
        const pdfPublicPath = `/uploads/pdf/${req.file.filename}`;

        // pdftoppm adds "-1.png" to the end of the prefix we provide
        const coverFileName = `${baseName}-1.png`;
        const coverDiskPath = path.join(coversDir, coverFileName);
        const coverPublicPath = `/uploads/covers/${coverFileName}`;

        // Helper function to handle the process spawning as a Promise
        const generateCover = () => {
            return new Promise((resolve) => {
                const proc = spawn("pdftoppm", [
                    "-f", "1",
                    "-l", "1",
                    "-png",
                    "-singlefile", // Forces output to be exactly the name we provide
                    pdfDiskPath,
                    path.join(coversDir, baseName)
                ]);

                proc.on("close", (code) => {
                    // pdftoppm with -singlefile will save as baseName.png
                    // Without -singlefile, it saves as baseName-1.png
                    // We check if either the exact filename or the -1 version exists
                    const finalPath = path.join(coversDir, `${baseName}.png`);
                    const altPath = path.join(coversDir, `${baseName}-1.png`);

                    if (code === 0 && (fs.existsSync(finalPath) || fs.existsSync(altPath))) {
                        // Return the public path of whichever one was created
                        resolve(fs.existsSync(finalPath) ? `/uploads/covers/${baseName}.png` : coverPublicPath);
                    } else {
                        console.warn("⚠️ pdftoppm failed or file not found");
                        resolve(null);
                    }
                });

                proc.on("error", (err) => {
                    console.error("❌ pdftoppm spawn error:", err);
                    resolve(null);
                });
            });
        };

        // Wait for the cover to be generated BEFORE creating the DB record
        const coverPath = await generateCover();

        const book = await Book.create({
            title: req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: pdfPublicPath,
            cover: coverPath, // This will now contain the path or null
            folder: "default",
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
        console.error(err);
        res.status(500).json({ error: "Action failed" });
    }
});

module.exports = router;