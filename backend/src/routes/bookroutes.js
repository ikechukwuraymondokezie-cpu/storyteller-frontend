const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");
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
    if (!visionClient) return "[OCR Error: Vision Client not initialized]";
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
        console.error(`Google OCR Error on page ${pageNum}:`, e);
        return "";
    }
}

/* ---------------- BOOK ROUTES ---------------- */

// LAZY LOAD ROUTE (Triggered by frontend scrolling)
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

        // Parallel processing for efficiency
        const pagePromises = [];
        for (let i = startPage; i <= endPage; i++) {
            pagePromises.push(extractPageTextGoogle(tempPath, i));
        }
        const pagesResults = await Promise.all(pagePromises);
        const newText = pagesResults.join("\n\n");

        const updatedContent = book.content + "\n" + newText;
        const finalStatus = endPage >= book.totalPages ? 'completed' : 'processing';

        await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent,
            processedPages: endPage,
            status: finalStatus,
            // Re-calc words as we go for accuracy
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

// UPLOAD ROUTE (The Fast "Speechify" Version)
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });

        const pdfDiskPath = req.file.path;
        const dataBuffer = await fs.readFile(pdfDiskPath);

        // 1. INSTANT EXTRACTION & ESTIMATE
        let pdfData;
        try {
            pdfData = typeof pdf === 'function' ? await pdf(dataBuffer) : await pdf.default(dataBuffer);
        } catch (e) {
            pdfData = { numpages: 1, text: "" };
        }

        const totalPages = pdfData.numpages || 1;

        // Word count estimate logic
        const rawWords = pdfData.text ? pdfData.text.split(/\s+/).filter(w => w.length > 0).length : 0;
        const estimatedWords = rawWords > 50 ? rawWords : (totalPages * 300);

        // 2. CREATE BOOK IMMEDIATELY
        const book = await Book.create({
            title: req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: "pending",
            cover: "https://via.placeholder.com/300x450?text=Processing...",
            folder: req.body.folder || "All",
            content: "Scanning first pages...",
            totalPages: totalPages,
            processedPages: 0,
            status: 'processing',
            words: estimatedWords
        });

        // 3. RESPOND TO USER NOW (No more timeouts!)
        res.status(201).json(book);

        // 4. BACKGROUND PROCESSOR (Async Worker)
        (async () => {
            try {
                const baseName = path.parse(req.file.filename).name;
                const outputPrefix = path.join(coversDir, baseName);

                // Step A: Background Cloudinary Uploads
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

                // Update metadata so cover shows up in Library
                await Book.findByIdAndUpdate(book._id, { pdfPath: cloudPdfUrl, cover: coverUrl });

                // Step B: Initial OCR (First 5 pages)
                let highQualText = "";
                const instantLimit = Math.min(5, totalPages);

                for (let i = 1; i <= instantLimit; i++) {
                    const pageText = await extractPageTextGoogle(pdfDiskPath, i);
                    highQualText += pageText + "\n\n";

                    // Update live page-by-page
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