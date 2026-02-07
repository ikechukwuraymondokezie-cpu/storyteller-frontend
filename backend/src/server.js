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
// We still keep these for temporary processing before sending to Cloudinary
const uploadsBase = path.join(__dirname, "uploads");
const uploadDir = path.join(uploadsBase, "pdfs");
const coversDir = path.join(uploadsBase, "covers");

fs.ensureDirSync(uploadDir);
fs.ensureDirSync(coversDir);

app.use("/uploads", express.static(uploadsBase));

/* -------------------- MONGODB -------------------- */
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB error:", err));

/* -------------------- SCHEMAS -------------------- */
const Folder = mongoose.model("Folder", new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}));

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    cover: String,
    pdfPath: String, // Will now store Cloudinary URL
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

/* -------------------- API ROUTES -------------------- */

// Get Folders
app.get("/api/books/folders", async (_, res) => {
    try {
        const folders = await Folder.find().sort({ name: 1 });
        res.json(["All", ...folders.map(f => f.name)]);
    } catch {
        res.status(500).json({ error: "Failed to fetch folders" });
    }
});

// Create Folder
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

// Get All Books
app.get("/api/books", async (_, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books.map(formatBook));
    } catch {
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

// Get Single Book
app.get("/api/books/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });
        res.json(formatBook(book));
    } catch {
        res.status(500).json({ error: "Error fetching book" });
    }
});

/**
 * UPLOAD BOOK (WITH CLOUDINARY RAW STORAGE)
 */
app.post("/api/books", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, "");
        const folder = req.body.folder || "All";
        const pdfFullPath = req.file.path;

        // 1. Upload PDF to Cloudinary as "raw"
        const uploadPdf = async () => {
            const result = await cloudinary.uploader.upload(pdfFullPath, {
                folder: "storyteller_pdfs",
                resource_type: "raw", // MUST be raw for non-image files
                public_id: `${Date.now()}-${req.file.originalname}`
            });
            return result.secure_url;
        };

        // 2. Generate Thumbnail using pdftoppm
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
                    await fs.remove(tempLocalCoverPath); // Clean up local png
                    resolve(uploadRes.secure_url);
                } catch (cloudErr) {
                    console.error("Cover Upload Error:", cloudErr);
                    resolve(null);
                }
            });
        });

        // Run both uploads
        const [pdfUrl, coverUrl] = await Promise.all([uploadPdf(), generateThumbnail()]);

        // 3. Save to Database
        const book = await Book.create({
            title,
            pdfPath: pdfUrl,
            cover: coverUrl,
            folder
        });

        // 4. CLEAN UP: Delete the temporary local PDF
        await fs.remove(pdfFullPath);

        res.status(201).json(formatBook(book));
    } catch (err) {
        console.error("Upload error:", err);
        // Clean up on failure if file exists
        if (req.file) await fs.remove(req.file.path);
        res.status(500).json({ error: "Upload failed" });
    }
});

// Rename
app.patch("/api/books/:id/rename", async (req, res) => {
    try {
        const { title } = req.body;
        const book = await Book.findByIdAndUpdate(req.params.id, { title }, { new: true });
        res.json(formatBook(book));
    } catch {
        res.status(500).json({ error: "Rename failed" });
    }
});

// Delete
app.delete("/api/books/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (book) {
            // Note: Cloudinary deletion would require extra logic using public_id
            // For now, we just delete the DB record
            await book.deleteOne();
        }
        res.json({ message: "Deleted" });
    } catch {
        res.status(500).json({ error: "Delete failed" });
    }
});

/* -------------------- SERVER START -------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});