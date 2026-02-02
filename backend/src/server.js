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
// Updated CORS to be more robust for your specific Frontend URL
app.use(cors({
    origin: "https://storyteller-b1i3.onrender.com",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
}));
app.use(express.json());

/* -------------------- UPLOADS -------------------- */
const uploadDir = path.join(__dirname, "../uploads/pdf");
const coversDir = path.join(__dirname, "../uploads/covers");
const audioDir = path.join(__dirname, "../uploads/audio");

fs.ensureDirSync(uploadDir);
fs.ensureDirSync(coversDir);
fs.ensureDirSync(audioDir);

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

/* -------------------- MONGODB -------------------- */
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB error:", err));

/* -------------------- SCHEMAS -------------------- */
// New Schema for Folders so they don't disappear when empty
const Folder = mongoose.model("Folder", new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}));

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    cover: String,
    pdfPath: String,
    folder: { type: String, default: "All" }, // Changed "default" to "All" for cleaner UI
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
    folder: book.folder,
    downloads: book.downloads,
    ttsRequests: book.ttsRequests,
});

const deleteBookFiles = async (book) => {
    try {
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

// GET ALL UNIQUE FOLDERS (From the Folder Model)
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

app.post("/api/books", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const title = req.file.originalname.replace(/\.[^/.]+$/, "");
        const folder = req.body.folder || "All";
        const pdfPath = `/uploads/pdf/${req.file.filename}`;
        const pdfFullPath = req.file.path;
        const baseName = path.parse(req.file.filename).name;
        const outputPrefix = path.join(coversDir, baseName);

        const generateThumbnail = () => new Promise((resolve) => {
            exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfFullPath}" "${outputPrefix}"`, (error) => {
                if (error) return resolve(null);
                resolve(`/uploads/covers/${baseName}.png`);
            });
        });

        const cover = await generateThumbnail();
        const book = await Book.create({ title, pdfPath, cover, folder });
        res.status(201).json(formatBook(book));
    } catch (err) {
        res.status(500).json({ error: "Upload failed" });
    }
});

// MOVE BOOK TO FOLDER
app.patch("/api/books/:id/move", async (req, res) => {
    try {
        const { folderName } = req.body;
        const book = await Book.findByIdAndUpdate(req.params.id, { folder: folderName }, { new: true });
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});