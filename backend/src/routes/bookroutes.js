const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");

// FIX: Standard import
const pdf = require("pdf-parse");
const vision = require('@google-cloud/vision');

const Book = require("../models/Book");
const Folder = require("../models/Folder");

const router = express.Router();

/* ---------------- GOOGLE VISION CONFIG ---------------- */
let visionClient;
try {
    const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (creds && creds.trim().startsWith('{')) {
        visionClient = new vision.ImageAnnotatorClient({
            credentials: JSON.parse(creds)
        });
        console.log("✅ Vision Client Ready");
    } else {
        console.warn("⚠️ Vision credentials missing or invalid");
    }
} catch (err) {
    console.error("❌ Google Vision Parse Error:", err.message);
}

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

async function extractPageTextGoogle(pdfPath, pageNum) {
    if (!visionClient) return "";

    const uniqueId = Date.now() + "_" + Math.round(Math.random() * 1000);
    const pageImgBase = path.join(coversDir, `google_tmp_${pageNum}_${uniqueId}`);
    const pageImgFull = `${pageImgBase}.png`;

    try {
        console.log(`[OCR] Page ${pageNum}: Extracting image...`);
        await new Promise((resolve, reject) => {
            exec(`pdftoppm -f ${pageNum} -l ${pageNum} -png -singlefile "${pdfPath}" "${pageImgBase}"`, (err) => {
                if (err) reject(err); else resolve();
            });
        });

        console.log(`[OCR] Page ${pageNum}: Sending to Google Vision...`);
        const [result] = await visionClient.textDetection(pageImgFull);
        const text = result.fullTextAnnotation ? result.fullTextAnnotation.text : "";

        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);
        return text;
    } catch (e) {
        console.error(`❌ Google OCR Error on page ${pageNum}:`, e.message);
        return "";
    }
}

/* ---------------- BOOK ROUTES ---------------- */

router.get("/:id/load-pages", async (req, res) => {
    let tempPath = "";
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        const startPage = book.processedPages + 1;
        const endPage = Math.min(startPage + 4, book.totalPages);

        if (startPage > book.totalPages) return res.json({ addedText: "", status: "completed" });

        tempPath = path.join(pdfDir, `temp_load_${book._id}.pdf`);

        const response = await axios({ url: book.pdfPath, method: 'GET', responseType: 'stream' });
        const writer = fs.createWriteStream(tempPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Parallel processing for lazy load
        const pagePromises = [];
        for (let i = startPage; i <= endPage; i++) {
            pagePromises.push(extractPageTextGoogle(tempPath, i));
        }
        const results = await Promise.all(pagePromises);
        const newText = results.join("\n\n");

        const updatedContent = book.content + "\n" + newText;
        const finalStatus = endPage >= book.totalPages ? 'completed' : 'processing';

        await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent,
            processedPages: endPage,
            status: finalStatus,
            words: updatedContent.split(/\s+/).filter(w => w.length > 0).length
        });

        res.json({ addedText: newText, processedPages: endPage, status: finalStatus });
    } catch (err) {
        console.error("Lazy Load Error:", err);
        res.status(500).json({ error: "Lazy load failed" });
    } finally {
        if (tempPath && await fs.pathExists(tempPath)) await fs.remove(tempPath);
    }
});

router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        const pdfDiskPath = req.file.path;
        const baseName = path.parse(req.file.filename).name;
        const outputPrefix = path.join(coversDir, baseName);

        const dataBuffer = await fs.readFile(pdfDiskPath);

        let pdfData;
        if (typeof pdf === 'function') {
            pdfData = await pdf(dataBuffer);
        } else if (pdf && typeof pdf.default === 'function') {
            pdfData = await pdf.default(dataBuffer);
        } else {
            pdfData = { numpages: 1 };
        }

        const totalPages = pdfData.numpages || 1;
        console.log(`📖 Uploading "${req.file.originalname}" - ${totalPages} pages.`);

        const generateCover = () => new Promise((resolve) => {
            exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfDiskPath}" "${outputPrefix}"`, async (error) => {
                if (error) return resolve(null);
                const localPath = `${outputPrefix}.png`;
                try {
                    const uploadRes = await cloudinary.uploader.upload(localPath, { folder: "storyteller_covers" });
                    await fs.remove(localPath);
                    resolve(uploadRes.secure_url);
                } catch { resolve(null); }
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

        // PARALLEL OCR: Processing first 5 pages at once
        const instantLimit = Math.min(5, totalPages);
        console.log(`⚡ Processing first ${instantLimit} pages in parallel...`);

        const pagePromises = [];
        for (let i = 1; i <= instantLimit; i++) {
            pagePromises.push(extractPageTextGoogle(pdfDiskPath, i));
        }

        const pagesResults = await Promise.all(pagePromises);
        const initialText = pagesResults.join("\n\n");
        const wordCount = initialText.split(/\s+/).filter(w => w.length > 0).length;

        const book = await Book.create({
            title: req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: cloudPdfUrl,
            cover: coverUrl || "https://via.placeholder.com/300x450?text=No+Cover",
            folder: req.body.folder || "All",
            content: initialText,
            totalPages: totalPages,
            processedPages: instantLimit,
            status: totalPages <= instantLimit ? 'completed' : 'processing',
            words: wordCount
        });

        if (await fs.pathExists(pdfDiskPath)) await fs.remove(pdfDiskPath);
        console.log(`✅ Upload Successful: ${wordCount} words extracted.`);

        res.status(201).json(book);
    } catch (err) {
        console.error("Upload Error:", err);
        if (req.file && await fs.pathExists(req.file.path)) await fs.remove(req.file.path);
        res.status(500).json({ error: "Upload failed" });
    }
});

module.exports = router;