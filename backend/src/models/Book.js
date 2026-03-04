const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
    {
        // CRITICAL: Link book to a specific user
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        title: { type: String, required: true },
        words: { type: Number, default: 0 },
        cover: { type: String },
        pdfPath: { type: String },
        content: { type: String, default: "" },
        summary: { type: String, default: "" },
        folder: { type: String, default: "All" },
        downloads: { type: Number, default: 0 },
        ttsRequests: { type: Number, default: 0 },

        // Updated to match the "toc" naming convention in your routes
        toc: [{
            text: { type: String },
            page: { type: Number },
            type: { type: String, default: 'visual' } // 'visual' for OCR, 'native' for PDF metadata
        }],

        totalPages: { type: Number, default: 0 },
        processedPages: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['processing', 'completed'],
            default: 'processing'
        },
    },
    { timestamps: true }
);

// Optional: Add an index for faster user-library lookups
bookSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Book", bookSchema);