const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        // Changed to Number so frontend can format it (e.g., "120,000 words")
        words: { type: Number, default: 0 },
        cover: { type: String },          // URL/Path to thumbnail image
        pdfPath: { type: String },        // URL/Path to uploaded PDF

        // NEW: Stores the full text extracted from the PDF for Digital Mode
        content: { type: String },

        // NEW: Stores the AI-generated summary for the Summary Pill
        summary: { type: String },

        // Updated default to "All" to align with frontend tabs
        folder: { type: String, default: "All" },
        downloads: { type: Number, default: 0 },
        ttsRequests: { type: Number, default: 0 }, // track TTS requests
    },
    { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);