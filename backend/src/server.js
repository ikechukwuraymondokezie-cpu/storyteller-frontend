require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* -------------------- UPLOADS -------------------- */
// Using absolute paths to prevent "file not found" issues during deletion
const uploadDir = path.join(__dirname, "../uploads/pdf");
const coversDir = path.join(__dirname, "../uploads/covers");
const audioDir = path.join(__dirname, "../uploads/audio");

fs.ensureDirSync(uploadDir);
fs.ensureDirSync(coversDir);
fs.ensureDirSync(audioDir);

// Serve the entire uploads folder
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

/* -------------------- MONGODB -------------------- */
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error("❌ MONGO_URI missing");
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
const formatBook = (book) => ({
    _id: book._id,
    title: book.title,
    cover: book.cover || null,
    url: book.pdfPath || null,
    folder: book.folder,
    downloads: book.downloads,
    ttsRequests: book.ttsRequests,
});

const deleteBookFiles = async (book) => {
    try {
        // pdfPath usually looks like "/uploads/pdf/filename.pdf"
        if (book.pdfPath) {
            const fullPdfPath = path.join(__dirname, "..", book.pdfPath);
            if (await fs.pathExists(fullPdfPath)) await fs.remove(fullPdfPath);
        }
        if (book.cover) {
            const fullCoverPath = path.join(__dirname, "..", book.cover);
            if (await fs.pathExists(fullCoverPath)) await fs.remove(fullCoverPath);
        }
    } catch (err) {
        console.error("⚠️ Error deleting files:", err);
    }
};

/* -------------------- API ROUTES -------------------- */

// GET ALL BOOKS
app.get("/api/books", async (_, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books.map(formatBook));
    } catch {
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

// GET ALL UNIQUE FOLDERS
app.get("/api/books/folders", async (_, res) => {
    try {
        // Returns an array of strings: ["default", "Sci-Fi", "Work"]
        const folders = await Book.distinct("folder");
        // Filter out "default" if you don't want it in the tab bar
        res.json(folders.filter(f => f !== "default"));
    } catch {
        res.status(500).json({ error: "Failed to fetch folders" });
    }
});

// CREATE NEW FOLDER (Placeholder to keep Frontend happy)
app.post("/api/books/folders", async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Folder name required" });
        res.status(201).json({ name });
    } catch {
        res.status(500).json({ error: "Folder creation failed" });
    }
});

// UPLOAD BOOK (Updated to handle folders)
app.post("/api/books", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const title = req.file.originalname.replace(/\.[^/.]+$/, "");
        const folder = req.body.folder || "default"; // Get folder from frontend
        const pdfPath = `/uploads/pdf/${req.file.filename}`;
        const pdfFullPath = req.file.path;
        const baseName = path.parse(req.file.filename).name;
        const outputPrefix = path.join(coversDir, baseName);

        const generateThumbnail = () =>
            new Promise((resolve) => {
                // Requires 'poppler-utils' installed on the server/system
                exec(
                    `pdftoppm -f 1 -l 1 -png -singlefile "${pdfFullPath}" "${outputPrefix}"`,
                    (error) => {
                        if (error) {
                            console.error("Thumbnail error:", error);
                            return resolve(null);
                        }
                        resolve(`/uploads/covers/${baseName}.png`);
                    }
                );
            });

        const cover = await generateThumbnail();
        const book = await Book.create({
            title,
            pdfPath,
            cover,
            folder
        });

        res.status(201).json({
            message: "Upload successful",
            book: formatBook(book)
        });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

// DELETE SINGLE BOOK
app.delete("/api/books/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        await deleteBookFiles(book);
        await Book.findByIdAndDelete(req.params.id);

        res.json({ message: "Book deleted successfully" });
    } catch {
        res.status(500).json({ error: "Delete failed" });
    }
});

// BULK DELETE
app.post("/api/books/bulk-delete", async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) return res.status(400).json({ error: "No IDs provided" });

        const books = await Book.find({ _id: { $in: ids } });
        await Promise.all(books.map(deleteBookFiles));
        await Book.deleteMany({ _id: { $in: ids } });

        res.json({ message: `${books.length} books deleted` });
    } catch {
        res.status(500).json({ error: "Bulk delete failed" });
    }
});

// ACTIONS (Download/TTS Counter)
app.patch("/api/books/:id/actions", async (req, res) => {
    try {
        const { action } = req.body;
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        if (action === "download") book.downloads++;
        if (action === "tts") book.ttsRequests++;

        await book.save();
        res.json(formatBook(book));
    } catch {
        res.status(500).json({ error: "Action failed" });
    }
});

/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});