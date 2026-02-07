require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;

const app = express();

/* -------------------- CLOUDINARY CONFIG -------------------- */
cloudinary.config();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors({
    origin: ["https://storyteller-b1i3.onrender.com", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
}));
app.use(express.json());

/* -------------------- UPLOADS & STATIC FILES -------------------- */
const uploadsBase = path.join(__dirname, "uploads");
// UPDATED: Folder name changed from 'pdf' to 'pdfs'
const uploadDir = path.join(uploadsBase, "pdfs");
const coversDir = path.join(uploadsBase, "covers");
const audioDir = path.join(uploadsBase, "audio");

// Ensure directories exist
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(coversDir);
fs.ensureDirSync(audioDir);

/**
 * STATIC SERVING:
 * Maps the URL /uploads to the physical folder.
 */
app.use("/uploads", express.static(uploadsBase));

/* -------------------- MONGODB -------------------- */
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log("✅ MongoDB connected");

        /* --- AUTOMATIC DATA FIX FOR FOLDER NAME --- */
        try {
            const booksToFix = await Book.find({ pdfPath: { $regex: /^\/uploads\/pdf\// } });
            if (booksToFix.length > 0) {
                for (let book of booksToFix) {
                    book.pdfPath = book.pdfPath.replace("/uploads/pdf/", "/uploads/pdfs/");
                    await book.save();
                }
                console.log(`🛠️ Fixed ${booksToFix.length} book paths from /pdf/ to /pdfs/`);
            }
        } catch (err) {
            console.error("Migration error:", err);
        }
    })
    .catch((err) => console.error("❌ MongoDB error:", err));

/* -------------------- SCHEMAS -------------------- */
const Folder = mongoose.model("Folder", new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}));

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    cover: String,
    pdfPath: String,
    folder: { type: String, default: "All" },
    downloads: { type: Number, default: 0 },
    ttsRequests: { type: Number, default: 0 },
}, { timestamps: true });

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
    folder: book.folder || "All",
    downloads: book.downloads,
    ttsRequests: book.ttsRequests,
    createdAt: book.createdAt
});

const deleteBookFiles = async (book) => {
    try {
        if (book.pdfPath) {
            const relativePath = book.pdfPath.startsWith('/') ? book.pdfPath.substring(1) : book.pdfPath;
            const fullPdfPath = path.join(__dirname, relativePath);
            if (await fs.pathExists(fullPdfPath)) await fs.remove(fullPdfPath);
        }
    } catch (err) {
        console.error("⚠️ Error deleting files:", err);
    }
};

/* -------------------- API ROUTES -------------------- */

app.get("/api/books/folders", async (_, res) => {
    try {
        const folders = await Folder.find().sort({ name: 1 });
        res.json(["All", ...folders.map(f => f.name)]);
    } catch {
        res.status(500).json({ error: "Failed to fetch folders" });
    }
});

app.post("/api/books/folders", async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name === "All") return res.status(400).json({ error: "Invalid name" });
        const folder = await Folder.findOneAndUpdate({ name }, { name }, { upsert: true, new: true });
        res.status(201).json(folder);
    } catch {
        res.status(500).json({ error: "Folder creation failed" });
    }
});

app.get("/api/books", async (_, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books.map(formatBook));
    } catch {
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

app.get("/api/books/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });
        res.json(formatBook(book));
    } catch {
        res.status(500).json({ error: "Error fetching book" });
    }
});

// Upload Book
app.post("/api/books", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const title = req.file.originalname.replace(/\.[^/.]+$/, "");
        const folder = req.body.folder || "All";

        // UPDATED: Changed path to /pdfs/
        const pdfPath = `/uploads/pdfs/${req.file.filename}`;
        const pdfFullPath = req.file.path;

        const baseName = path.parse(req.file.filename).name;
        const tempLocalCoverPath = path.join(coversDir, `${baseName}.png`);
        const outputPrefix = path.join(coversDir, baseName);

        const generateThumbnail = () => new Promise((resolve) => {
            exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfFullPath}" "${outputPrefix}"`, async (error) => {
                if (error) {
                    console.error("pdftoppm error:", error);
                    return resolve(null);
                }
                try {
                    const uploadRes = await cloudinary.uploader.upload(tempLocalCoverPath, {
                        folder: "storyteller_covers"
                    });
                    await fs.remove(tempLocalCoverPath);
                    resolve(uploadRes.secure_url);
                } catch (cloudErr) {
                    console.error("Cloudinary Error:", cloudErr);
                    resolve(null);
                }
            });
        });

        const coverUrl = await generateThumbnail();
        const book = await Book.create({ title, pdfPath, cover: coverUrl, folder });

        res.status(201).json(formatBook(book));
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

app.patch("/api/books/:id/rename", async (req, res) => {
    try {
        const { title } = req.body;
        const book = await Book.findByIdAndUpdate(req.params.id, { title }, { new: true });
        res.json(formatBook(book));
    } catch {
        res.status(500).json({ error: "Rename failed" });
    }
});

app.patch("/api/books/:id/move", async (req, res) => {
    try {
        const { folder } = req.body;
        const book = await Book.findByIdAndUpdate(req.params.id, { folder: folder || "All" }, { new: true });
        res.json(formatBook(book));
    } catch {
        res.status(500).json({ error: "Move failed" });
    }
});

app.delete("/api/books/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (book) {
            await deleteBookFiles(book);
            await book.deleteOne();
        }
        res.json({ message: "Deleted" });
    } catch {
        res.status(500).json({ error: "Delete failed" });
    }
});

app.post("/api/books/bulk-delete", async (req, res) => {
    try {
        const { ids } = req.body;
        const books = await Book.find({ _id: { $in: ids } });
        await Promise.all(books.map(deleteBookFiles));
        await Book.deleteMany({ _id: { $in: ids } });
        res.json({ message: "Bulk delete success" });
    } catch {
        res.status(500).json({ error: "Bulk delete failed" });
    }
});

app.patch("/api/books/:id/actions", async (req, res) => {
    try {
        const { action } = req.body;
        const update = action === "download" ? { $inc: { downloads: 1 } } : { $inc: { ttsRequests: 1 } };
        const book = await Book.findByIdAndUpdate(req.params.id, update, { new: true });
        res.json(formatBook(book));
    } catch {
        res.status(500).json({ error: "Action failed" });
    }
});

/* -------------------- SERVER START -------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});