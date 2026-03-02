require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");
const vision = require('@google-cloud/vision');

// IMPORTS
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const { protect } = require("./middleware/authMiddleware");

/* -------------------- DEBUG LOGS -------------------- */
console.log("--- STARTUP DEBUGGING ---");
console.log("userRoutes type:", typeof userRoutes);
console.log("authRoutes type:", typeof authRoutes);
console.log("protect function type:", typeof protect);
console.log("-------------------------");

const app = express();

/* -------------------- GOOGLE VISION CONFIG -------------------- */
let visionClient;
try {
    const credsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credsEnv && credsEnv.trim().startsWith('{')) {
        visionClient = new vision.ImageAnnotatorClient({
            credentials: JSON.parse(credsEnv)
        });
        console.log("✅ Google Vision Client Initialized (Structured Mode)");
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

// The lines causing the crash on Render
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

/* -------------------- MONGODB -------------------- */
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB error:", err));

/* -------------------- SCHEMAS & MODELS -------------------- */
const Folder = mongoose.model("Folder", new mongoose.Schema({
    name: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}));

const bookSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
    status: book.status || "processing",
    totalPages: book.totalPages || 0,
    processedPages: book.processedPages || 0,
    summary: book.summary || "",
    createdAt: book.createdAt
});

function smartClean(text) {
    if (!text) return "";
    return text
        .replace(/([a-z0-9])\s*(Chapter\s+\d+|Psalm|Section|BOOKS\s+BY|Part)/gi, '$1\n\n$2')
        .replace(/(Chapter\s+\d+.*?)\s+(The\s+authority|Because|In\s+the|For\s+this|When|If)/gi, '$1\n\n$2')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim();
}

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
            exec(`pdftoppm -f ${pageNum} -l ${pageNum} -png -r 300 -singlefile "${pdfPath}" "${pageImgBase}"`, (err) => {
                if (err) reject(err); else resolve();
            });
        });

        const [result] = await visionClient.documentTextDetection(pageImgFull);
        const fullAnnotation = result.fullTextAnnotation;
        if (!fullAnnotation) return "";

        let pageBlocks = [];
        fullAnnotation.pages.forEach(page => {
            page.blocks.forEach(block => {
                const vertices = block.boundingBox.vertices;
                const yTop = vertices[0].y;
                const yBottom = vertices[3].y;
                const xCoord = vertices[0].x;
                const blockHeight = yBottom - yTop;

                const blockText = block.paragraphs.map(p =>
                    p.words.map(w => w.symbols.map(s => s.text).join('')).join(' ')
                ).join('\n');

                pageBlocks.push({ text: blockText, x: xCoord, y: yTop, h: blockHeight });
            });
        });

        pageBlocks.sort((a, b) => (a.y - b.y) || (a.x - b.x));
        let orderedText = "";
        const TOP_MARGIN_THRESHOLD = 150;

        for (let i = 0; i < pageBlocks.length; i++) {
            const current = pageBlocks[i];
            const next = pageBlocks[i + 1];
            if (i === 0 && current.y > TOP_MARGIN_THRESHOLD) orderedText += "\n\n";
            orderedText += current.text;
            if (next) {
                const verticalGap = next.y - (current.y + current.h);
                orderedText += (verticalGap > current.h * 1.8) ? "\n\n\n" : "\n\n";
            }
        }

        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
        return smartClean(orderedText);
    } catch (e) {
        console.error(`❌ Google OCR Error on page ${pageNum}:`, e.message);
        return "";
    }
}

/* -------------------- API ROUTES -------------------- */

app.get("/api/books/:id/load-pages", async (req, res) => {
    let tempPdfPath = "";
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        const startPage = (book.processedPages || 0) + 1;
        const endPage = Math.min(startPage + 4, book.totalPages);

        if (startPage > book.totalPages) {
            return res.json({ message: "End", addedText: "", status: 'completed' });
        }

        tempPdfPath = path.join(uploadDir, `temp_load_${book._id}.pdf`);
        if (!(await fs.pathExists(tempPdfPath))) {
            const response = await axios.get(book.pdfPath, { responseType: 'arraybuffer' });
            await fs.writeFile(tempPdfPath, Buffer.from(response.data));
        }

        const pagePromises = [];
        for (let i = startPage; i <= endPage; i++) {
            pagePromises.push(extractPageTextGoogle(tempPdfPath, i));
        }

        const results = await Promise.all(pagePromises);
        const newText = results.filter(t => t).join("\n\n");

        const updatedContent = (book.content || "").trim() + "\n\n" + newText;
        const newWordCount = updatedContent.split(/\s+/).filter(w => w.length > 0).length;
        const isFinished = endPage >= book.totalPages;

        const updatedBook = await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent.trim(),
            processedPages: endPage,
            words: newWordCount,
            status: isFinished ? 'completed' : 'processing'
        }, { new: true });

        if (isFinished && await fs.pathExists(tempPdfPath)) await fs.remove(tempPdfPath);

        res.json({
            addedText: newText,
            processedPages: endPage,
            status: updatedBook.status
        });
    } catch (err) {
        console.error("Lazy load error:", err.message);
        res.status(500).json({ error: "Lazy load failed" });
    }
});

app.post("/api/books", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const pdfPath = req.file.path;
        const totalPages = await getPageCount(pdfPath);

        const book = await Book.create({
            title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ""),
            folder: req.body.folder || "All",
            pdfPath: "pending",
            cover: "https://via.placeholder.com/300x450?text=Processing...",
            content: "",
            totalPages,
            words: 0,
            status: 'processing'
        });

        res.status(201).json(formatBook(book));

        (async () => {
            try {
                const pdfRes = await cloudinary.uploader.upload(pdfPath, { folder: "storyteller_pdfs", resource_type: "raw" });
                const baseName = path.parse(req.file.filename).name;
                const outputPrefix = path.join(coversDir, baseName);

                const coverUrl = await new Promise((resolve) => {
                    exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfPath}" "${outputPrefix}"`, async (err) => {
                        if (err) return resolve(null);
                        const uploadRes = await cloudinary.uploader.upload(`${outputPrefix}.png`, { folder: "storyteller_covers" });
                        await fs.remove(`${outputPrefix}.png`);
                        resolve(uploadRes.secure_url);
                    });
                });

                await Book.findByIdAndUpdate(book._id, { pdfPath: pdfRes.secure_url, cover: coverUrl });

                let runningContent = "";
                const limit = Math.min(5, totalPages);
                for (let i = 1; i <= limit; i++) {
                    const pageText = await extractPageTextGoogle(pdfPath, i);
                    if (pageText) runningContent += pageText + "\n\n";
                    const actualWords = runningContent.split(/\s+/).filter(w => w.length > 0).length;

                    await Book.findByIdAndUpdate(book._id, {
                        content: runningContent.trim(),
                        processedPages: i,
                        words: actualWords,
                        status: i >= totalPages ? 'completed' : 'processing'
                    });
                }
                if (await fs.pathExists(pdfPath)) await fs.remove(pdfPath);
            } catch (bgErr) {
                console.error("BG Worker Error:", bgErr.message);
            }
        })();
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

/* --- OTHER ROUTES --- */
app.get("/api/books/folders", protect, async (req, res) => {
    try {
        const folders = await Folder.find({ user: req.user._id }).sort({ name: 1 });
        res.json(["All", ...folders.map(f => f.name)]);
    } catch { res.status(500).json({ error: "Failed to fetch folders" }); }
});

app.post("/api/books/folders", protect, async (req, res) => {
    try {
        const folder = await Folder.create({ name: req.body.name, user: req.user._id });
        res.status(201).json(folder);
    } catch { res.status(400).json({ error: "Folder already exists or creation failed" }); }
});

app.delete("/api/books/folders/:name", protect, async (req, res) => {
    try {
        await Folder.findOneAndDelete({ name: req.params.name, user: req.user._id });
        await Book.updateMany({ folder: req.params.name, user: req.user._id }, { folder: "All" });
        res.json({ message: "Folder deleted and books moved to All" });
    } catch { res.status(500).json({ error: "Failed to delete folder" }); }
});

/* --- PROTECTED BOOK ROUTES --- */
app.get("/api/books", protect, async (req, res) => {
    try {
        const books = await Book.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(books.map(formatBook));
    } catch { res.status(500).json({ error: "Failed to fetch books" }); }
});

app.get("/api/books/:id", protect, async (req, res) => {
    try {
        const book = await Book.findOne({ _id: req.params.id, user: req.user._id });
        if (!book) return res.status(404).json({ error: "Book not found or unauthorized" });
        res.json(formatBook(book));
    } catch { res.status(500).json({ error: "Error fetching book" }); }
});

app.patch("/api/books/:id", protect, async (req, res) => {
    try {
        const book = await Book.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true });
        if (!book) return res.status(404).json({ error: "Update failed: Book not found" });
        res.json(formatBook(book));
    } catch { res.status(500).json({ error: "Failed to update book" }); }
});

app.delete("/api/books/:id", protect, async (req, res) => {
    try {
        const result = await Book.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!result) return res.status(404).json({ error: "Delete failed: Unauthorized" });
        res.json({ message: "Book deleted successfully" });
    } catch { res.status(500).json({ error: "Failed to delete book" }); }
});

/* --- START --- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", async () => {
    console.log(`✅ Server running on port ${PORT}`);
    try {
        await fs.emptyDir(uploadDir);
        await fs.emptyDir(coversDir);
    } catch (e) { console.warn("Initial cleanup failed"); }
});