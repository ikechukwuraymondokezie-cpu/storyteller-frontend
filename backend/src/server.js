require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const pdf = require("pdf-poppler");

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* -------------------- UPLOADS FOLDER -------------------- */
// server.js is inside /src → go one level up
const uploadDir = path.join(__dirname, "../uploads");
const coversDir = path.join(uploadDir, "covers");

fs.ensureDirSync(uploadDir);
fs.ensureDirSync(coversDir);

// Serve uploaded PDFs and covers
app.use("/uploads", express.static(uploadDir));

/* -------------------- MONGODB -------------------- */
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("❌ MONGO_URI is not defined");
    process.exit(1);
}

mongoose
    .connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => {
        console.error("❌ MongoDB error:", err);
        process.exit(1);
    });

/* -------------------- SCHEMA -------------------- */
const bookSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        cover: String,
        pdfPath: String,
        folder: { type: String, default: "default" },
        downloads: { type: Number, default: 0 },
        ttsRequests: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const Book = mongoose.model("Book", bookSchema);

/* -------------------- MULTER -------------------- */
const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

/* -------------------- HELPERS -------------------- */
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

const formatBook = (book) => ({
    _id: book._id,
    title: book.title,
    cover: book.cover ? `${BACKEND_URL}${book.cover}` : null,
    url: book.pdfPath ? `${BACKEND_URL}${book.pdfPath}` : null,
    folder: book.folder,
    downloads: book.downloads,
    ttsRequests: book.ttsRequests,
});

/* -------------------- ROUTES -------------------- */

// Health check
app.get("/", (_, res) => {
    res.json({ status: "Backend running 🚀" });
});

/* ---------- GET ALL BOOKS ---------- */
app.get("/api/books", async (_, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books.map(formatBook));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

/* ---------- UPLOAD BOOK + PDF COVER ---------- */
app.post("/api/books/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const title = req.file.originalname.replace(/\.[^/.]+$/, "");
        const pdfPath = `/uploads/${req.file.filename}`;
        let coverPath = null;

        // Generate cover from first page
        try {
            const opts = {
                format: "png",
                out_dir: coversDir,
                out_prefix: path.parse(req.file.filename).name,
                page: 1,
            };

            await pdf.convert(path.join(uploadDir, req.file.filename), opts);

            coverPath = `/uploads/covers/${opts.out_prefix}-1.png`;
        } catch (err) {
            console.warn("⚠️ PDF cover generation failed:", err.message);
        }

        const book = await Book.create({
            title,
            pdfPath,
            cover: coverPath,
        });

        res.status(201).json({
            message: "Upload successful",
            book: formatBook(book),
        });
    } catch (err) {
        console.error("❌ Upload failed:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

/* ---------- PATCH DOWNLOAD / TTS ---------- */
app.patch("/api/books/:id/actions", async (req, res) => {
    try {
        const { action } = req.body;
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        if (action === "download") book.downloads++;
        if (action === "tts") book.ttsRequests++;

        await book.save();
        res.json(formatBook(book));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Action failed" });
    }
});

/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
    console.log(`✅ Server running on port ${PORT}`)
);
