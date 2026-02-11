require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;

// Standard imports
const pdf = require("pdf-parse");
const vision = require('@google-cloud/vision');

const app = express();

/* -------------------- GOOGLE VISION CONFIG -------------------- */
let visionClient;
try {
    const credsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credsEnv && credsEnv.trim().startsWith('{')) {
        visionClient = new vision.ImageAnnotatorClient({
            credentials: JSON.parse(credsEnv)
        });
        console.log("✅ Google Vision Client Initialized");
    } else {
        console.warn("⚠️ GOOGLE_APPLICATION_CREDENTIALS_JSON missing or invalid");
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
    status: book.status || "completed",
    totalPages: book.totalPages || 0,
    processedPages: book.processedPages || 0,
    summary: book.summary || "",
    createdAt: book.createdAt
});

// Robust Page Counting Helper
function getPageCount(pdfPath) {
    return new Promise((resolve) => {
        exec(`pdfinfo "${pdfPath}" | grep Pages: | awk '{print $2}'`, (err, stdout) => {
            if (err) return resolve(1);
            const count = parseInt(stdout.trim());
            resolve(isNaN(count) ? 1 : count);
        });
    });
}

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
        console.error(`❌ Google OCR Error on page ${pageNum}:`, e.message);
        return "";
    }
}

/* -------------------- API ROUTES -------------------- */

// LAZY LOAD
app.get("/api/books/:id/load-pages", async (req, res) => {
    let tempPdfPath = "";
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        const startPage = book.processedPages + 1;
        const endPage = Math.min(startPage + 4, book.totalPages);

        if (startPage > book.totalPages) {
            return res.json({ message: "End", addedText: "", status: 'completed' });
        }

        tempPdfPath = path.join(uploadDir, `temp_load_${book._id}.pdf`);

        if (!(await fs.pathExists(tempPdfPath))) {
            const response = await fetch(book.pdfPath);
            if (!response.ok) throw new Error("Could not fetch PDF");
            const arrayBuffer = await response.arrayBuffer();
            await fs.writeFile(tempPdfPath, Buffer.from(arrayBuffer));
        }

        const pagePromises = [];
        for (let i = startPage; i <= endPage; i++) {
            pagePromises.push(extractPageTextGoogle(tempPdfPath, i));
        }

        const results = await Promise.all(pagePromises);
        const newText = results.filter(t => t).join("\n\n");

        const updatedContent = book.content + "\n\n" + newText;
        const newWordCount = updatedContent.split(/\s+/).filter(w => w.length > 0).length;
        const isFinished = endPage >= book.totalPages;

        const updatedBook = await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent,
            processedPages: endPage,
            words: newWordCount,
            status: isFinished ? 'completed' : 'processing'
        }, { new: true });

        res.json({
            addedText: newText,
            processedPages: endPage,
            status: updatedBook.status
        });
    } catch (err) {
        console.error("Lazy load error:", err);
        res.status(500).json({ error: "Lazy load failed" });
    }
});

// UPLOAD
app.post("/api/books", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const pdfPath = req.file.path;

        // 1. Get Real Page Count
        const totalPages = await getPageCount(pdfPath);
        console.log(`✅ File: ${req.file.originalname} | Total Pages: ${totalPages}`);

        // 2. Create Placeholder with real page count but estimated words
        const book = await Book.create({
            title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ""),
            folder: req.body.folder || "All",
            pdfPath: "pending",
            cover: "https://via.placeholder.com/300x450?text=Processing...",
            content: "Scanning first pages...",
            totalPages,
            words: totalPages * 300,
            status: 'processing'
        });

        // 3. Respond Immediately
        res.status(201).json(formatBook(book));

        // 4. Background Worker
        (async () => {
            try {
                const baseName = path.parse(req.file.filename).name;
                const outputPrefix = path.join(coversDir, baseName);

                const [pdfUrl, coverUrl] = await Promise.all([
                    cloudinary.uploader.upload(pdfPath, { folder: "storyteller_pdfs", resource_type: "raw" }).then(r => r.secure_url),
                    new Promise((resolve) => {
                        exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfPath}" "${outputPrefix}"`, async (err) => {
                            if (err) return resolve(null);
                            const uploadRes = await cloudinary.uploader.upload(`${outputPrefix}.png`, { folder: "storyteller_covers" });
                            await fs.remove(`${outputPrefix}.png`);
                            resolve(uploadRes.secure_url);
                        });
                    })
                ]);

                await Book.findByIdAndUpdate(book._id, { pdfPath: pdfUrl, cover: coverUrl });

                let runningContent = "";
                const limit = Math.min(5, totalPages);
                for (let i = 1; i <= limit; i++) {
                    const pageText = await extractPageTextGoogle(pdfPath, i);
                    runningContent += pageText + "\n\n";

                    // RECALCULATE REAL WORDS
                    const actualWords = runningContent.split(/\s+/).filter(w => w.length > 0).length;

                    await Book.findByIdAndUpdate(book._id, {
                        content: runningContent,
                        processedPages: i,
                        words: actualWords,
                        status: i >= totalPages ? 'completed' : 'processing'
                    });
                }

                // Only delete when the initial batch is finished
                if (await fs.pathExists(pdfPath)) await fs.remove(pdfPath);
                console.log(`✅ Finished processing initial pages for ${book.title}`);
            } catch (bgErr) { console.error("BG Error:", bgErr); }
        })();

    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

/* --- FOLDER ROUTES --- */
app.get("/api/books/folders", async (_, res) => {
    try {
        const folders = await Folder.find().sort({ name: 1 });
        res.json(["All", ...folders.map(f => f.name)]);
    } catch { res.status(500).json({ error: "Failed" }); }
});

app.post("/api/books/folders", async (req, res) => {
    try {
        const folder = await Folder.create({ name: req.body.name });
        res.status(201).json(folder);
    } catch { res.status(400).json({ error: "Exists" }); }
});

app.delete("/api/books/folders/:name", async (req, res) => {
    try {
        await Folder.findOneAndDelete({ name: req.params.name });
        await Book.updateMany({ folder: req.params.name }, { folder: "All" });
        res.json({ message: "Deleted" });
    } catch { res.status(500).json({ error: "Failed" }); }
});

/* --- MANAGEMENT ROUTES --- */
app.get("/api/books", async (_, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books.map(formatBook));
    } catch { res.status(500).json({ error: "Failed" }); }
});

app.get("/api/books/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Not found" });
        res.json(formatBook(book));
    } catch { res.status(500).json({ error: "Error" }); }
});

app.patch("/api/books/:id", async (req, res) => {
    try {
        const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(formatBook(book));
    } catch { res.status(500).json({ error: "Failed" }); }
});

app.delete("/api/books/:id", async (req, res) => {
    try {
        await Book.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch { res.status(500).json({ error: "Failed" }); }
});

/* --- START --- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", async () => {
    console.log(`✅ Server running on port ${PORT}`);
    try {
        await fs.emptyDir(uploadDir);
        await fs.emptyDir(coversDir);
    } catch (e) { console.warn("Cleanup failed"); }
});