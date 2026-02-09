const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        // Number format for frontend display
        words: { type: Number, default: 0 },
        cover: { type: String },          // URL/Path to thumbnail image
        pdfPath: { type: String },        // URL/Path to uploaded PDF

        // Stores the full text extracted from the PDF
        content: { type: String, default: "" },

        // Stores the AI-generated summary
        summary: { type: String, default: "" },

        // FOLDER & ANALYTICS
        folder: { type: String, default: "All" },
        downloads: { type: Number, default: 0 },
        ttsRequests: { type: Number, default: 0 },

        /* -------------------- NEW FIELDS FOR OCR & TOC -------------------- */

        // Stores the detected Table of Contents
        chapters: [{
            title: String,
            page: Number
        }],

        // Total pages in the PDF
        totalPages: { type: Number, default: 0 },

        // How many pages have been OCR'd so far
        processedPages: { type: Number, default: 0 },

        // Track if the background worker is still running
        status: {
            type: String,
            enum: ['processing', 'completed'],
            default: 'processing'
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);