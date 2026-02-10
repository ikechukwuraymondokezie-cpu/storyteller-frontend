require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;

// FIX: Correct import for pdf-parse
const pdf = require("pdf-parse/lib/pdf-parse.js");
const vision = require('@google-cloud/vision');

const app = express();

/* -------------------- GOOGLE VISION CONFIG -------------------- */
let visionClient;
try {
    const credsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credsEnv) {
        visionClient = new vision.ImageAnnotatorClient({
            credentials: JSON.parse(credsEnv)
        });
        console.log("✅ Google Vision Client Initialized");
    } else {
        console.warn("⚠️ GOOGLE_APPLICATION_CREDENTIALS_JSON is missing");
    }
} catch (e) {
    console.error("❌ Google Vision Init Error:", e.message);
}

/* -------------------- CLOUDINARY CONFIG -------------------- */
cloudinary.config();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors({
    origin: ["https://storyteller-b1i3.onrender.com", "http://localhost:5173", "https://storyteller-frontend-x65b.onrender.com"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));

/* -------------------- UPLOADS & STATIC FILES -------------------- */
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
    pdfPath: String,
    folder: { type: String, default: "All" },
    downloads: { type: Number, default: 0 },
    ttsRequests: { type: Number, default: 0 },
    content: { type: String, default: "" },
    chapters: [{ title: String, page: Number }],
    words: { type: Number, default: 0 },
    totalPages: { type: Number, default: 0 },
    processedPages: { type: Number, default: 0 },
    status: { type: String, enum: ['processing', 'completed'], default: 'processing' },
    summary: { type: String }
}, { timestamps: true });

const Book = mongoose.model("Book", bookSchema);

/* -------------------- MULTER -------------------- */
const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, '_');
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + "-" + safeName);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

/* -------------------- HELPERS -------------------- */
const formatBook = (book) => ({
    _id: book._id,
    title: book.title,
    cover: book.cover || null,
    url: book.pdfPath || null,
    folder: book.folder || "All",
    downloads: book.downloads,
    ttsRequests: book.ttsRequests,
    words: book.words || 0,
    content: book.content || "",
    chapters: book.chapters || [],
    status: book.status || "completed",
    totalPages: book.totalPages || 0,
    processedPages: book.processedPages || 0,
    summary: book.summary || "",
    createdAt: book.createdAt
});

async function extractPageTextGoogle(pdfPath, pageNum) {
    if (!visionClient) return "";
    const uniqueId = Date.now() + "_" + Math.round(Math.random() * 1000);
    const pageImgBase = path.join(coversDir, `tmp_google_${pageNum}_${uniqueId}`);
    const pageImgFull = `${pageImgBase}.png`;

    try {
        await new Promise((resolve, reject) => {
            exec(`pdftoppm -f ${pageNum} -l ${pageNum} -png -singlefile "${pdfPath}" "${pageImgBase}"`, (err) => {
                if (err) reject(err); else resolve();
            });
        });

        const [result] = await visionClient.textDetection(pageImgFull);
        const text = result.fullTextAnnotation ? result.fullTextAnnotation.text : "";

        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
        return text;
    } catch (e) {
        console.error(`Google OCR Error on page ${pageNum}:`, e);
        return "";
    }
}

/* -------------------- API ROUTES -------------------- */

// Lazy Load Endpoint
app.get("/api/books/:id/load-pages", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        const startPage = book.processedPages + 1;
        const endPage = Math.min(startPage + 4, book.totalPages);

        if (startPage > book.totalPages) return res.json({ message: "End", addedText: "" });

        const tempPdfPath = path.join(uploadDir, `temp_load_${book._id}.pdf`);
        const response = await fetch(book.pdfPath);
        const arrayBuffer = await response.arrayBuffer();
        await fs.writeFile(tempPdfPath, Buffer.from(arrayBuffer));

        let newText = "";
        for (let i = startPage; i <= endPage; i++) {
            const text = await extractPageTextGoogle(tempPdfPath, i);
            newText += text + "\n\n";
        }

        await fs.remove(tempPdfPath);

        const updatedContent = book.content + "\n" + newText;
        const updatedBook = await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent,
            processedPages: endPage,
            status: endPage === book.totalPages ? 'completed' : 'processing',
            words: updatedContent.split(/\s+/).filter(w => w.length > 0).length
        }, { new: true });

        res.json({ addedText: newText, processedPages: endPage });
    } catch (err) {
        res.status(500).json({ error: "Lazy load failed" });
    }
});

// Book Upload
app.post("/api/books", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, "");
        const folder = req.body.folder || "All";
        const pdfPath = req.file.path;
        const baseName = path.parse(req.file.filename).name;
        const outputPrefix = path.join(coversDir, baseName);

        const dataBuffer = await fs.readFile(pdfPath);
        const meta = await pdf(dataBuffer);
        const totalPages = meta.numpages || 1;

        const generateThumbnail = () => new Promise((resolve) => {
            exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfPath}" "${outputPrefix}"`, async (error) => {
                if (error) return resolve(null);
                try {
                    const localPath = `${outputPrefix}.png`;
                    const uploadRes = await cloudinary.uploader.upload(localPath, { folder: "storyteller_covers" });
                    await fs.remove(localPath);
                    resolve(uploadRes.secure_url);
                } catch { resolve(null); }
            });
        });

        const uploadPdfToCloud = async () => {
            const result = await cloudinary.uploader.upload(pdfPath, {
                folder: "storyteller_pdfs",
                resource_type: "raw"
            });
            return result.secure_url;
        };

        const [pdfUrl, coverUrl] = await Promise.all([uploadPdfToCloud(), generateThumbnail()]);

        const instantLimit = Math.min(5, totalPages);
        let initialContent = "";
        for (let i = 1; i <= instantLimit; i++) {
            const text = await extractPageTextGoogle(pdfPath, i);
            initialContent += text + "\n\n";
        }

        const book = await Book.create({
            title,
            cover: coverUrl || "https://via.placeholder.com/300x450?text=No+Cover",
            pdfPath: pdfUrl,
            folder,
            content: initialContent,
            totalPages,
            processedPages: instantLimit,
            status: totalPages <= instantLimit ? 'completed' : 'processing',
            words: initialContent.split(/\s+/).filter(w => w.length > 0).length
        });

        if (await fs.pathExists(pdfPath)) await fs.remove(pdfPath);

        res.status(201).json(formatBook(book));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed" });
    }
});

/* --- FOLDER ROUTES --- */
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
        const folder = await Folder.create({ name: req.body.name });
        res.status(201).json(folder);
    } catch (err) {
        res.status(400).json({ error: "Folder exists or invalid name" });
    }
});

app.delete("/api/books/folders/:name", async (req, res) => {
    try {
        await Folder.findOneAndDelete({ name: req.params.name });
        await Book.updateMany({ folder: req.params.name }, { folder: "All" });
        res.json({ message: "Folder deleted" });
    } catch {
        res.status(500).json({ error: "Failed to delete folder" });
    }
});

/* --- BOOK MANAGEMENT ROUTES --- */
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

app.patch("/api/books/:id", async (req, res) => {
    try {
        const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(formatBook(book));
    } catch {
        res.status(500).json({ error: "Update failed" });
    }
});

app.delete("/api/books/:id", async (req, res) => {
    try {
        await Book.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch {
        res.status(500).json({ error: "Delete failed" });
    }
});

/* --- SERVER START --- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});