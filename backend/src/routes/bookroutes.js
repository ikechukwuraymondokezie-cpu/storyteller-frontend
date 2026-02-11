const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;
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
        console.error(`Google OCR Error on page ${pageNum}:`, e.message);
        return "";
    }
}

/* ---------------- BOOK ROUTES ---------------- */

/**
 * LAZY LOAD ROUTE
 * Handles on-demand OCR for large books as the user scrolls.
 */
router.get("/:id/load-pages", async (req, res) => {
    let tempPath = "";
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        const startPage = book.processedPages + 1;
        const endPage = Math.min(startPage + 4, book.totalPages);

        if (startPage > book.totalPages) {
            return res.json({ addedText: "", status: "completed" });
        }

        tempPath = path.join(pdfDir, `temp_load_${book._id}.pdf`);

        // Download from Cloudinary only if not already present on disk
        if (!(await fs.pathExists(tempPath))) {
            const response = await fetch(book.pdfPath);
            const buffer = Buffer.from(await response.arrayBuffer());
            await fs.writeFile(tempPath, buffer);
        }

        const pagePromises = [];
        for (let i = startPage; i <= endPage; i++) {
            pagePromises.push(extractPageTextGoogle(tempPath, i));
        }

        const pagesResults = await Promise.all(pagePromises);
        const newText = pagesResults.filter(t => t).join("\n\n");

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
    }
});

/**
 * UPLOAD ROUTE
 * Creates book record instantly and handles processing in background.
 */
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const pdfDiskPath = req.file.path;
        const dataBuffer = await fs.readFile(pdfDiskPath);

        // 1. Initial Parse for Metadata
        let pdfData;
        try {
            pdfData = await pdf(dataBuffer);
        } catch (e) {
            pdfData = { numpages: 1, text: "" };
        }

        const totalPages = pdfData.numpages || 1;
        const rawWords = pdfData.text ? pdfData.text.split(/\s+/).filter(w => w.length > 0).length : 0;
        const estimatedWords = rawWords > 50 ? rawWords : (totalPages * 300);

        // 2. Initial DB Record
        const book = await Book.create({
            title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: "pending",
            cover: "https://via.placeholder.com/300x450?text=Processing...",
            folder: req.body.folder || "All",
            content: "Scanning first pages...",
            totalPages,
            processedPages: 0,
            status: 'processing',
            words: estimatedWords
        });

        // 3. Immediate Response
        res.status(201).json(book);

        // 4. Background Processor
        (async () => {
            try {
                const baseName = path.parse(req.file.filename).name;
                const outputPrefix = path.join(coversDir, baseName);

                // A: Cloudinary & Cover Extraction
                const [cloudPdfUrl, coverUrl] = await Promise.all([
                    cloudinary.uploader.upload(pdfDiskPath, { folder: "storyteller_pdfs", resource_type: "raw" }).then(r => r.secure_url),
                    new Promise((resolve) => {
                        exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfDiskPath}" "${outputPrefix}"`, async (err) => {
                            if (err) return resolve(null);
                            const uploadRes = await cloudinary.uploader.upload(`${outputPrefix}.png`, { folder: "storyteller_covers" });
                            await fs.remove(`${outputPrefix}.png`);
                            resolve(uploadRes.secure_url);
                        });
                    })
                ]);

                await Book.findByIdAndUpdate(book._id, { pdfPath: cloudPdfUrl, cover: coverUrl });

                // B: OCR for first 5 pages
                let highQualText = "";
                const instantLimit = Math.min(5, totalPages);

                for (let i = 1; i <= instantLimit; i++) {
                    const pageText = await extractPageTextGoogle(pdfDiskPath, i);
                    highQualText += pageText + "\n\n";

                    await Book.findByIdAndUpdate(book._id, {
                        content: highQualText,
                        processedPages: i,
                        status: i >= totalPages ? 'completed' : 'processing'
                    });
                }

                if (await fs.pathExists(pdfDiskPath)) await fs.remove(pdfDiskPath);
            } catch (bgErr) {
                console.error("Background Worker Error:", bgErr);
            }
        })();

    } catch (err) {
        console.error("Critical Upload Error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

module.exports = router;