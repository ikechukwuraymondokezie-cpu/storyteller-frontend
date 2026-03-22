const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
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
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    cover: { type: String, default: "" }, // URL to Cloudinary
    genre: {
        type: String,
        enum: [
            'Romance', 'Thriller', 'Fantasy', 'Sci-Fi', 'Mystery',
            'Horror', 'Drama', 'Comedy', 'Adventure', 'Historical',
            'African Fiction', 'Urban Fiction', 'Other'
        ],
        default: 'Other'
    },
    tags: [{ type: String, lowercase: true, trim: true }],
    chapters: [chapterSchema],
    freeChapterCount: { type: Number, default: 3 },
    status: {
        type: String,
        enum: ['draft', 'published', 'suspended'],
        default: 'draft'
    },
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    totalChapters: { type: Number, default: 0 },
    hasAuvie: { type: Boolean, default: false },
    auvie: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auvie',
        default: null
    },
    unlockPrice: { type: Number, default: 50 },
}, { timestamps: true });

// Auto-update totalChapters before saving
novelSchema.pre('save', function (next) {
    if (this.chapters) {
        this.totalChapters = this.chapters.length;
    }
    next();
});

// Indexes
// Note: If Render still gives issues, we can remove the 'text' index and use regex search
novelSchema.index({ title: 'text', description: 'text', tags: 'text' });
novelSchema.index({ author: 1, status: 1 });
novelSchema.index({ genre: 1, status: 1 });
novelSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Novel', novelSchema);