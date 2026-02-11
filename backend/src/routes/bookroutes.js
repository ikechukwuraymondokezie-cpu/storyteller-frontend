const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { exec } = require("child_process");
const cloudinary = require("cloudinary").v2;
const pdf = require("pdf-parse");
const vision = require('@google-cloud/vision');

const Book = require("../models/Book");
const router = express.Router();

/* ---------------- HELPERS ---------------- */

// Robust Page Counting Helper (Poppler is more reliable than pdf-parse)
function getPageCount(pdfPath) {
    return new Promise((resolve) => {
        exec(`pdfinfo "${pdfPath}" | grep Pages: | awk '{print $2}'`, (err, stdout) => {
            if (err) return resolve(0);
            const count = parseInt(stdout.trim());
            resolve(isNaN(count) ? 0 : count);
        });
    });
}

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
        return "";
    }
}

/* ---------------- ROUTES ---------------- */

router.get("/:id/load-pages", async (req, res) => {
    let tempPath = "";
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found" });

        const startPage = book.processedPages + 1;
        const endPage = Math.min(startPage + 4, book.totalPages);

        if (startPage > book.totalPages) return res.json({ addedText: "", status: "completed" });

        tempPath = path.join(pdfDir, `temp_load_${book._id}.pdf`);
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
        const updatedContent = book.content + "\n\n" + newText;

        // CRITICAL: Update word count based on ACTUAL text
        const actualWordCount = updatedContent.split(/\s+/).filter(w => w.length > 0).length;

        await Book.findByIdAndUpdate(req.params.id, {
            content: updatedContent,
            processedPages: endPage,
            status: endPage >= book.totalPages ? 'completed' : 'processing',
            words: actualWordCount
        });

        res.json({ addedText: newText, processedPages: endPage, status: "ok" });
    } catch (err) {
        res.status(500).json({ error: "Lazy load failed" });
    }
});

router.post("/", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });
        const pdfDiskPath = req.file.path;

        // Use pdfinfo for accurate page count
        const totalPages = await getPageCount(pdfDiskPath);

        const book = await Book.create({
            title: req.body.title || req.file.originalname.replace(/\.[^/.]+$/, ""),
            pdfPath: "pending",
            cover: "https://via.placeholder.com/300x450?text=Processing...",
            folder: req.body.folder || "All",
            content: "Scanning...",
            totalPages,
            processedPages: 0,
            status: 'processing',
            words: totalPages * 300 // Temporary estimate
        });

        res.status(201).json(book);

        // Background worker
        (async () => {
            try {
                const baseName = path.parse(req.file.filename).name;
                const outputPrefix = path.join(coversDir, baseName);

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
                const limit = Math.min(5, totalPages);
                for (let i = 1; i <= limit; i++) {
                    const text = await extractPageTextGoogle(pdfDiskPath, i);
                    runningText += text + "\n\n";

                    const wordCount = runningText.split(/\s+/).filter(w => w.length > 0).length;

                    await Book.findByIdAndUpdate(book._id, {
                        content: runningText,
                        processedPages: i,
                        words: wordCount,
                        status: i >= totalPages ? 'completed' : 'processing'
                    });
                }
                if (await fs.pathExists(pdfDiskPath)) await fs.remove(pdfDiskPath);
            } catch (e) { console.error(e); }
        })();
    } catch (err) {
        res.status(500).json({ error: "Upload failed" });
    }
});

module.exports = router;