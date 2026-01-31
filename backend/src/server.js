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
const uploadDir = path.join(__dirname, "../uploads/pdf");
const coversDir = path.join(__dirname, "../uploads/covers");
const audioDir = path.join(__dirname, "../uploads/audio");

fs.ensureDirSync(uploadDir);
fs.ensureDirSync(coversDir);
fs.ensureDirSync(audioDir);

// Serve uploaded files
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
const BACKEND_URL = process.env.BACKEND_URL || "https://storyteller-frontend-x65b.onrender.co";

const formatBook = (book) => ({
    _id: book._id,
    title: book.title,
    cover: book.cover ? `${BACKEND_URL}${book.cover}` : null,
    url: book.pdfPath ? `${BACKEND_URL}${book.pdfPath}` : null,
    folder: book.folder,
    downloads: book.downloads,
    ttsRequests: book.ttsRequests,
});

/* -------------------- API ROUTES -------------------- */
app.get("/api", (_, res) => {
    res.json({ status: "Backend running 🚀" });
});

app.get("/api/books", async (_, res) => {
    try {
        const books = await Book.find().sort({ createdAt: -1 });
        res.json(books.map(formatBook));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

app.post("/api/books/upload", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const title = req.file.originalname.replace(/\.[^/.]+$/, "");
        const pdfPath = `/uploads/pdf/${req.file.filename}`;
        const pdfFullPath = path.join(uploadDir, req.file.filename);

        const baseName = path.parse(req.file.filename).name;
        const coverPath = `/uploads/covers/${baseName}-1.png`;
        const outputPrefix = path.join(coversDir, baseName);

        exec(
            `pdftoppm -f 1 -l 1 -png "${pdfFullPath}" "${outputPrefix}"`,
            async (error) => {
                if (error) console.error("❌ pdftoppm error:", error);

                const book = await Book.create({
                    title,
                    pdfPath,
                    cover: fs.existsSync(path.join(coversDir, `${baseName}-1.png`))
                        ? coverPath
                        : null,
                });

                res.status(201).json({
                    message: "Upload successful",
                    book: formatBook(book),
                });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed" });
    }
});

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

/* -------------------- OPTIONAL FRONTEND SERVE -------------------- */
const frontendBuildPath = path.join(
    __dirname,
    "../../storyteller-frontend/build"
);

if (fs.existsSync(frontendBuildPath)) {
    app.use(express.static(frontendBuildPath));

    // Serve React SPA for any route NOT starting with /api
    app.get(/^(?!\/api).*/, (_, res) => {
        const indexPath = path.join(frontendBuildPath, "index.html");
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send("React build not found");
        }
    });

    console.log("✅ Serving React frontend from", frontendBuildPath);
} else {
    console.log(
        "ℹ️ Frontend build not found at",
        frontendBuildPath,
        "— API only mode"
    );
}
