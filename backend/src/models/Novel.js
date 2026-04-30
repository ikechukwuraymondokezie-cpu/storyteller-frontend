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

    // ── STAFF PICKS ───────────────────────────────────────────────────
    isStaffPick: { type: Boolean, default: false, index: true },
    staffPickOrder: { type: Number, default: 0 },

}, { timestamps: true });

/* ── MODERN MIDDLEWARE FIX ──────────────────────────────────────────────
 * We remove the 'next' argument and use a standard function. 
 * Mongoose handles this synchronously or via Promise resolution.
 * ─────────────────────────────────────────────────────────────────────── */
novelSchema.pre('save', function () {
    if (this.chapters) {
        this.totalChapters = this.chapters.length;
    }
});

novelSchema.index({ title: 'text', description: 'text', tags: 'text' });
novelSchema.index({ author: 1, status: 1 });
novelSchema.index({ genre: 1, status: 1 });
novelSchema.index({ createdAt: -1 });
novelSchema.index({ views: -1 });
novelSchema.index({ isStaffPick: 1, staffPickOrder: 1 });

module.exports = mongoose.model('Novel', novelSchema);