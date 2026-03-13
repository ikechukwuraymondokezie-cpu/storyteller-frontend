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

        // --- CONTINUE LISTENING FIELDS ---
        // Tracks the last time the user opened this specific book
        lastAccessed: { type: Date, default: Date.now },

        // Stores the percentage or specific index where the user left off
        readingProgress: { type: Number, default: 0 },

        // Optional: Store the last chapter/section title for the UI
        currentChapter: { type: String, default: "Beginning" },

        // Updated to match the "toc" naming convention in your routes
        toc: [{
            text: { type: String },
            page: { type: Number },
            type: { type: String, default: 'visual' }
        }],

        totalPages: { type: Number, default: 0 },
        processedPages: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['processing', 'processing_pages', 'completed'],
            default: 'processing'
        },
    },
    { timestamps: true }
);

// Index for the Home Screen: Find newest books AND the most recently accessed
bookSchema.index({ user: 1, lastAccessed: -1 });
bookSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Book", bookSchema);