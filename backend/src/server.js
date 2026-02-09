require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;
const pdf = require("pdf-parse");
const Tesseract = require("tesseract.js");

const app = express();

/* -------------------- CLOUDINARY CONFIG -------------------- */
cloudinary.config();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors({
    origin: ["https://storyteller-b1i3.onrender.com", "http://localhost:5173", "https://storyteller-frontend-x65b.onrender.com"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increased for large book data

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
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
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

// Fast per-page OCR Helper
async function extractPageText(pdfPath, pageNum) {
    const pageImg = path.join(coversDir, `tmp_${pageNum}_${Date.now()}.png`);
    try {
        // Extract page to image
        await new Promise((resolve, reject) => {
            exec(`pdftoppm -f ${pageNum} -l ${pageNum} -png -singlefile "${pdfPath}" "${pageImg.replace('.png', '')}"`, (err) => {
                if (err) reject(err); else resolve();
            });
        });
        // OCR the image
        const { data: { text } } = await Tesseract.recognize(pageImg, 'eng');
        if (await fs.pathExists(pageImg)) await fs.remove(pageImg);
        return text;
    } catch (e) {
        console.error(`Error OCRing page ${pageNum}:`, e);
        return "";
    }
}

// Background Worker to finish long books
async function processRemainingPages(bookId, pdfPath, startPage, totalPages) {
    console.log(`🌀 Background: Processing pages ${startPage} to ${totalPages}`);
    try {
        let currentContent = "";
        const book = await Book.findById(bookId);
        currentContent = book.content;

        for (let i = startPage; i <= totalPages; i++) {
            const pageText = await extractPageText(pdfPath, i);
            currentContent += "\n" + pageText;

            // Batch update every 5 pages to save DB writes
            if (i % 5 === 0 || i === totalPages) {
                const wordCount = currentContent.split(/\s+/).filter(w => w.length > 0).length;
                await Book.findByIdAndUpdate(bookId, {
                    content: currentContent,
                    processedPages: i,
                    words: wordCount,
                    status: i === totalPages ? 'completed' : 'processing'
                });
            }
        }
        // Cleanup PDF from local storage once fully processed
        if (await fs.pathExists(pdfPath)) await fs.remove(pdfPath);
        console.log(`✅ Background processing complete for: ${bookId}`);
    } catch (err) {
        console.error("❌ Background Worker Error:", err);
    }
}

/* -------------------- API ROUTES -------------------- */

app.get("/api/books/folders", async (_, res) => {
    try {
        const folders = await Folder.find().sort({ name: 1 });
        res.json(["All", ...folders.map(f => f.name)]);
    } catch {
        res.status(500).json({ error: "Failed to fetch folders" });
    }
});

app.post("/api/books", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, "");
        const folder = req.body.folder || "All";
        const pdfPath = req.file.path;
        const baseName = path.parse(req.file.filename).name;
        const outputPrefix = path.join(coversDir, baseName);
        const tempLocalCoverPath = path.join(coversDir, `${baseName}.png`);

        // 1. Meta Data & Thumbnail
        const dataBuffer = await fs.readFile(pdfPath);
        const meta = await pdf(dataBuffer);
        const totalPages = meta.numpages;

        const generateThumbnail = () => new Promise((resolve) => {
            exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfPath}" "${outputPrefix}"`, async (error) => {
                if (error) return resolve(null);
                try {
                    const uploadRes = await cloudinary.uploader.upload(tempLocalCoverPath, { folder: "storyteller_covers" });
                    await fs.remove(tempLocalCoverPath);
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

        // 2. INSTANT PHASE: OCR First 10 Pages
        const instantPages = Math.min(10, totalPages);
        const pagePromises = [];
        for (let i = 1; i <= instantPages; i++) {
            pagePromises.push(extractPageText(pdfPath, i));
        }
        const pageTexts = await Promise.all(pagePromises);
        const initialContent = pageTexts.join("\n");

        // 3. INSTANT TOC GENERATION (From the 10 pages)
        const tocEntries = [];
        initialContent.split('\n').forEach(line => {
            const tocMatch = line.match(/^(.*?)(?:\.{2,}|…|\s{2,})(\d+)$/);
            if (tocMatch) tocEntries.push({ title: tocMatch[1].trim(), page: parseInt(tocMatch[2]) });
        });

        // 4. Create Database Entry
        const book = await Book.create({
            title,
            cover: coverUrl || "https://via.placeholder.com/300x450?text=No+Cover",
            pdfPath: pdfUrl,
            folder,
            content: initialContent,
            chapters: tocEntries,
            totalPages: totalPages,
            processedPages: instantPages,
            status: totalPages <= 10 ? 'completed' : 'processing',
            words: initialContent.split(/\s+/).length
        });

        // 5. Trigger Background Processing for remaining pages
        if (totalPages > 10) {
            processRemainingPages(book._id, pdfPath, 11, totalPages);
        } else {
            // Cleanup PDF if it was small enough to process fully now
            if (await fs.pathExists(pdfPath)) await fs.remove(pdfPath);
        }

        res.status(201).json(formatBook(book));
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

// Standard Book Routes
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

app.delete("/api/books/:id", async (req, res) => {
    try {
        await Book.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch {
        res.status(500).json({ error: "Delete failed" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on port ${PORT}`);
});