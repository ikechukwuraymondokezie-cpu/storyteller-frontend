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
        chapters: [{
            title: String,
            page: Number
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

module.exports = mongoose.model("Book", bookSchema);