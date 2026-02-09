const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;
const axios = require("axios"); // Added for temporary PDF downloading
const pdf = require("pdf-parse");
const vision = require('@google-cloud/vision'); // Added Google Vision

const Book = require("../models/Book");
const Folder = require("../models/Folder");

const router = express.Router();

/* ---------------- GOOGLE VISION CONFIG ---------------- */
// Uses the JSON string you added to Render Environment Variables
const visionClient = new vision.ImageAnnotatorClient({
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
});

/* ---------------- STORAGE CONFIG ---------------- */
const uploadsRoot = path.join(__dirname, "../uploads");
const pdfDir = path.join(uploadsRoot, "pdfs");
const coversDir = path.join(uploadsRoot, "covers");

fs.ensureDirSync(pdfDir);
fs.ensureDirSync(coversDir);

const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, pdfDir),
    filename: (_, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

/* ---------------- HELPERS ---------------- */

// NEW: Google Vision OCR Helper (RAM Efficient)
async function extractPageTextGoogle(pdfPath, pageNum) {
    const uniqueId = Date.now() + "_" + Math.round(Math.random() * 1000);
    const pageImgBase = path.join(coversDir, `google_tmp_${pageNum}_${uniqueId}`);
    const pageImgFull = `${pageImgBase}.png`;

    try {
        // 1. Convert PDF page to PNG
        await new Promise((resolve, reject) => {
            exec(`pdftoppm -f ${pageNum} -l ${pageNum} -png -singlefile "${pdfPath}" "${pageImgBase}"`, (err) => {
                if (err) reject(err); else resolve();
            });
        });

        // 2. OCR via Google Cloud
        const [result] = await visionClient.textDetection(pageImgFull);
        const text = result.fullTextAnnotation ? result.fullTextAnnotation.text : "";

        // 3. Cleanup image
        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
        return text;
    } catch (e) {
        console.error(`Google OCR Error on page ${pageNum}:`, e);
        return "";
    }
}

/* ---------------- BOOK ROUTES ---------------- */

/**
 * NEW: LAZY LOAD ROUTE
 * Triggers on the frontend when the user reaches the current end of text.
 */
router.get("/:id/load-pages", async (req, res) => {
    let tempPath = "";
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        const startPage = book.processedPages + 1;
        const endPage = Math.min(startPage + 4, book.totalPages); // Fetch 5 pages

        if (startPage > book.totalPages) return res.json({ addedText: "", status: "completed" });

        // 1. Download PDF from Cloudinary to process
        tempPath = path.join(pdfDir, `temp_load_${book._id}.pdf`);
        const response = await axios({ url: book.pdfPath, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

        // 2. OCR the requested pages
        let newText = "";
        for (let i = startPage; i <= endPage; i++) {
            const text = await extractPageTextGoogle(tempPath, i);
            newText += text + "\n\n";
        }

        // 3. Update DB
        const updatedContent = book.content + "\n" + newText;
        const finalStatus = endPage >= book.totalPages ? 'completed' : 'processing';

        await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent,
            processedPages: endPage,
            status: finalStatus,
            words: updatedContent.split(/\s+/).filter(w => w.length > 0).length
        });

        // 4. Cleanup temp PDF
        if (await fs.pathExists(tempPath)) await fs.remove(tempPath);

        res.json({ addedText: newText, processedPages: endPage, status: finalStatus });
    } catch (err) {
        if (tempPath && await fs.pathExists(tempPath)) await fs.remove(tempPath);
        res.status(500).json({ error: "Lazy load failed" });
    }
});

/**
 * UPLOAD BOOK: Now limited to initial 5 pages via Google
 */
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        const pdfDiskPath = req.file.path;
        const baseName = path.parse(req.file.filename).name;
        const outputPrefix = path.join(coversDir, baseName);

        const dataBuffer = await fs.readFile(pdfDiskPath);
        const meta = await pdf(dataBuffer);
        const totalPages = meta.numpages || 1;

        // Cover & PDF Cloudinary Upload
        const generateCover = () => new Promise((resolve) => {
            exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfDiskPath}" "${outputPrefix}"`, async (error) => {
                if (error) return resolve(null);
                const localPath = `${outputPrefix}.png`;
                const uploadRes = await cloudinary.uploader.upload(localPath, { folder: "storyteller_covers" });
                await fs.remove(localPath);
                resolve(uploadRes.secure_url);
            });
        });

        const uploadPdfToCloud = async () => {
            const result = await cloudinary.uploader.upload(pdfDiskPath, {
                folder: "storyteller_pdfs",
                resource_type: "raw"
            });
            return result.secure_url;
        };

        const [coverUrl, cloudPdfUrl] = await Promise.all([generateCover(), uploadPdfToCloud()]);

        // OCR exactly first 5 pages
        const instantLimit = Math.min(5, totalPages);
        let initialText = "";
        for (let i = 1; i <= instantLimit; i++) {
            const text = await extractPageTextGoogle(pdfDiskPath, i);
            initialText += text + "\n\n";
        }

        const book = await Book.create({
            title: req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: cloudPdfUrl,
            cover: coverUrl,
            folder: req.body.folder || "All",
            content: initialText,
            totalPages: totalPages,
            processedPages: instantLimit,
            status: totalPages <= instantLimit ? 'completed' : 'processing',
            words: initialText.split(/\s+/).filter(w => w.length > 0).length
        });

        // Cleanup local file immediately
        if (await fs.pathExists(pdfDiskPath)) await fs.remove(pdfDiskPath);

        res.status(201).json(book);
    } catch (err) {
        if (req.file && await fs.pathExists(req.file.path)) await fs.remove(req.file.path);
        res.status(500).json({ error: "Upload failed" });
    }
});

/* ... Rest of your Folder and Action routes stay exactly as they were ... */

module.exports = router;