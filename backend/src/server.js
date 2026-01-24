// src/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --------------------- MONGOOSE ---------------------
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/storyteller";

mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error(err));

// --------------------- SCHEMAS ---------------------
const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    words: { type: String },
    cover: { type: String },
    pdfPath: { type: String },
    folder: { type: String, default: "default" },
    downloads: { type: Number, default: 0 },
    ttsRequests: { type: Number, default: 0 },
}, { timestamps: true });

const Book = mongoose.model("Book", bookSchema);

// --------------------- MULTER UPLOAD ---------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// --------------------- ROUTES ---------------------

// Health check
app.get("/", (req, res) => res.json({ message: "Backend is running" }));

// GET all books
app.get("/api/books", async (req, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

// POST a new book
app.post("/api/books", upload.single("pdf"), async (req, res) => {
    try {
        const { title, words, cover, folder } = req.body;
        const pdfPath = req.file ? `/uploads/${req.file.filename}` : null;

        const newBook = await Book.create({ title, words, cover, pdfPath, folder });
        res.status(201).json(newBook);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to upload book" });
    }
});

// PATCH download count or TTS requests
app.patch("/api/books/:id/actions", async (req, res) => {
    try {
        const { action } = req.body; // "download" or "tts"
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        if (action === "download") book.downloads += 1;
        if (action === "tts") book.ttsRequests += 1;

        await book.save();
        res.json(book);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update book" });
    }
});

// GET books by folder
app.get("/api/books/folder/:folder", async (req, res) => {
    try {
        const books = await Book.find({ folder: req.params.folder });
        res.json(books);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch books by folder" });
    }
});

// --------------------- START SERVER ---------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
