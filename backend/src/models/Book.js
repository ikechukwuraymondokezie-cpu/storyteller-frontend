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
        pdfPath: { type: String, default: "" }, // Made default empty string for F3 novels
        content: { type: String, default: "" },
        summary: { type: String, default: "" },
        folder: { type: String, default: "All" },
        downloads: { type: Number, default: 0 },
        ttsRequests: { type: Number, default: 0 },

        // --- F3 WEB NOVEL INTEGRATION FIELDS ---
        source: {
            type: String,
            enum: ['upload', 'f3'],
            default: 'upload'
        },
        novelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Novel',
            default: null
        },
        genre: { type: String, default: "" },
        description: { type: String, default: "" },
        author: { type: String, default: "Unknown" },

        // --- CONTINUE LISTENING FIELDS ---
        lastAccessed: { type: Date, default: Date.now },
        readingProgress: { type: Number, default: 0 },
        currentChapter: { type: String, default: "Beginning" },

        toc: [{
            text: { type: String },
            page: { type: Number },
            type: { type: String, default: 'visual' }
        }],

        totalPages: { type: Number, default: 0 },
        processedPages: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['processing', 'processing_pages', 'completed', 'f3_novel'], // Added 'f3_novel' here
            default: 'processing'
        },
    },
    { timestamps: true }
);

// Indexes for fast querying on the Library & Home Screen
bookSchema.index({ user: 1, lastAccessed: -1 });
bookSchema.index({ user: 1, createdAt: -1 });
bookSchema.index({ user: 1, novelId: 1 }); // Fast check if a user already bookmarked an F3 novel

module.exports = mongoose.model("Book", bookSchema);