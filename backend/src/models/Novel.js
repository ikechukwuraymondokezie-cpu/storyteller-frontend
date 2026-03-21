const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, default: "" },
    order: { type: Number, required: true },
    isFree: { type: Boolean, default: false },
    wordCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const novelSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    cover: { type: String, default: "" },

    genre: {
        type: String,
        enum: [
            'Romance', 'Thriller', 'Fantasy', 'Sci-Fi', 'Mystery',
            'Horror', 'Drama', 'Comedy', 'Adventure', 'Historical',
            'African Fiction', 'Urban Fiction', 'Other'
        ],
        default: 'Other'
    },
    tags: [{ type: String }],

    chapters: [chapterSchema],

    // How many chapters are free before paywall
    freeChapterCount: { type: Number, default: 3 },

    status: {
        type: String,
        enum: ['draft', 'published', 'suspended'],
        default: 'draft'
    },

    // Stats
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    totalChapters: { type: Number, default: 0 },

    // Auvie link
    hasAuvie: { type: Boolean, default: false },
    auvie: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auvie',
        default: null
    },

    // Coin price to unlock full novel (chapters beyond free count)
    unlockPrice: { type: Number, default: 50 },

}, { timestamps: true });

// Full-text search index
novelSchema.index({ title: 'text', description: 'text', tags: 'text' });
novelSchema.index({ author: 1, status: 1 });
novelSchema.index({ genre: 1, status: 1 });
novelSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Novel', novelSchema);