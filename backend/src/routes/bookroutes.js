const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;
const vision = require('@google-cloud/vision');
const axios = require('axios');

const Book = require("../models/Book");
const router = express.Router();

// Initialize Vision Client
const visionClient = new vision.ImageAnnotatorClient();

// Setup paths for temporary processing
const pdfDir = path.join(__dirname, "../temp/pdfs");
const coversDir = path.join(__dirname, "../temp/covers");
fs.ensureDirSync(pdfDir);
fs.ensureDirSync(coversDir);

// Multer setup
const upload = multer({ dest: "temp/uploads/" });

/* ---------------- HELPERS ---------------- */

/**
 * SMARTER TEXT EXTRACTION (PRE-PROCESSING)
 * Cleans up noise, joins split words, and ensures formatting keywords start new blocks.
 */
function smartClean(text) {
    if (!text) return "";
    return text
        // 1. Join words split by hyphens at the end of a line (e.g., "au- \n thority")
        .replace(/(\w)-\s*\n(\w)/g, '$1$2')

        // 2. Force break BEFORE Chapter/Psalm/Section if it's stuck to previous text
        .replace(/([a-z0-9])\s*(Chapter\s+\d+|Psalm|Section|BOOKS\s+BY|Part|Book|Lesson)/gi, '$1\n\n$2')

        // 3. Force break AFTER a title but BEFORE the body text starts
        .replace(/(Chapter\s+\d+.*?)\s+(The\s+authority|Because|In\s+the|For\s+this|When\s+we)/gi, '$1\n\n$2')

        // 4. Clean up excessive horizontal whitespaces
        .replace(/[ \t]+/g, ' ')

        // 5. Ensure standardized double newlines for paragraph spacing
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function getPageCount(pdfPath) {
    return new Promise((resolve) => {
        exec(`pdfinfo "${pdfPath}" | grep Pages: | awk '{print $2}'`, (err, stdout) => {
            if (err) return resolve(0);
            const count = parseInt(stdout.trim());
            resolve(isNaN(count) ? 0 : count);
        });
    });
}

/**
 * IMPROVED OCR ENGINE
 * Uses documentTextDetection to respect visual blocks and group words into coherent paragraphs.
 */
async function extractPageTextGoogle(pdfPath, pageNum) {
    const uniqueId = Date.now() + "_" + Math.round(Math.random() * 1000);
    const pageImgBase = path.join(coversDir, `google_tmp_${pageNum}_${uniqueId}`);
    const pageImgFull = `${pageImgBase}.png`;

    try {
        // Convert PDF page to PNG image
        await new Promise((resolve, reject) => {
            exec(`pdftoppm -f ${pageNum} -l ${pageNum} -png -singlefile "${pdfPath}" "${pageImgBase}"`, (err) => {
                if (err) reject(err); else resolve();
            });
        });

        // Use documentTextDetection (optimized for dense text/books)
        const [result] = await visionClient.documentTextDetection(pageImgFull);
        const fullTextAnnotation = result.fullTextAnnotation;

        // Immediate cleanup of the temporary image to save disk space
        if (await fs.pathExists(pageImgFull)) await fs.remove(pageImgFull);

        if (!fullTextAnnotation) return "";

        let reconstructedText = "";

        // Reconstruct text by following the document hierarchy (Block > Paragraph > Word)
        fullTextAnnotation.pages.forEach(page => {
            page.blocks.forEach(block => {
                block.paragraphs.forEach(para => {
                    const paraString = para.words
                        .map(word => word.symbols.map(s => s.text).join(''))
                        .join(' ');

                    reconstructedText += paraString + "\n\n";
                });
            });
        });

        return smartClean(reconstructedText);
    } catch (e) {
        console.error(`OCR Error on page ${pageNum}:`, e);
        return "";
    }
}

/* ---------------- ROUTES ---------------- */

// 1. LAZY LOAD ROUTE (Fetches next 4 pages)
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

        // Download from Cloudinary to local temp if not already present
        if (!(await fs.pathExists(tempPath))) {
            const response = await axios.get(book.pdfPath, { responseType: 'arraybuffer' });
            await fs.writeFile(tempPath, Buffer.from(response.data));
        }

        const pagePromises = [];
        for (let i = startPage; i <= endPage; i++) {
            pagePromises.push(extractPageTextGoogle(tempPath, i));
        }

        const pagesResults = await Promise.all(pagePromises);
        const newText = pagesResults.filter(t => t).join("\n\n");
        const updatedContent = (book.content || "") + "\n\n" + newText;
        const actualWordCount = updatedContent.split(/\s+/).filter(w => w.length > 0).length;

        const updatedBook = await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent,
            processedPages: endPage,
            status: endPage >= book.totalPages ? 'completed' : 'processing',
            words: actualWordCount
        }, { new: true });

        // Cleanup the temp PDF if the book is fully processed
        if (updatedBook.status === 'completed') {
            await fs.remove(tempPath);
        }

        res.json({
            addedText: newText,
            processedPages: endPage,
            status: updatedBook.status,
            totalWords: actualWordCount
        });
    } catch (err) {
        console.error("Lazy Load Error:", err);
        res.status(500).json({ error: "Lazy load failed" });
    }
});

// 2. UPLOAD ROUTE
router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const pdfDiskPath = req.file.path;

        const totalPages = await getPageCount(pdfDiskPath);

        const book = await Book.create({
            title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: "pending",
            cover: "https://via.placeholder.com/300x450?text=Processing...",
            folder: req.body.folder || "All",
            content: "", // Start empty
            totalPages,
            processedPages: 0,
            status: 'processing',
            words: 0
        });

        res.status(201).json(book);

        // Background Worker for initial processing
        (async () => {
            try {
                const baseName = path.parse(req.file.filename).name;
                const outputPrefix = path.join(coversDir, baseName);

                // Parallel upload PDF and generate/upload Cover
                const [cloudUrl, coverUrl] = await Promise.all([
                    cloudinary.uploader.upload(pdfDiskPath, { folder: "storyteller_pdfs", resource_type: "raw" }).then(r => r.secure_url),
                    new Promise((resolve) => {
                        exec(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfDiskPath}" "${outputPrefix}"`, async (err) => {
                            if (err) return resolve(null);
                            const res = await cloudinary.uploader.upload(`${outputPrefix}.png`, { folder: "storyteller_covers" });
                            await fs.remove(`${outputPrefix}.png`);
                            resolve(res.secure_url);
                        });
                    })
                ]);

                await Book.findByIdAndUpdate(book._id, { pdfPath: cloudUrl, cover: coverUrl });

                let runningText = "";
                const limit = Math.min(5, totalPages); // Process first 5 pages immediately

                for (let i = 1; i <= limit; i++) {
                    const text = await extractPageTextGoogle(pdfDiskPath, i);
                    if (text) runningText += text + "\n\n";

                    const wordCount = runningText.split(/\s+/).filter(w => w.length > 0).length;

                    await Book.findByIdAndUpdate(book._id, {
                        content: runningText,
                        processedPages: i,
                        words: wordCount,
                        status: i >= totalPages ? 'completed' : 'processing'
                    });
                }

                // Delete local upload after Cloudinary and OCR are done
                if (await fs.pathExists(pdfDiskPath)) await fs.remove(pdfDiskPath);
            } catch (e) {
                console.error("Background Worker Error:", e);
            }
        })();
    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

module.exports = router;