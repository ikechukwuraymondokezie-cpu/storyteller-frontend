const mongoose = require('mongoose');

const snippetSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: { type: String, required: true },
    content: { type: String, required: true },

    // Optional pre-generated TTS audio
    audioUrl: { type: String, default: null },
    duration: { type: Number, default: 0 }, // seconds

    // Stats
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    plays: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['published', 'removed'],
        default: 'published'
    },

}, { timestamps: true });

snippetSchema.index({ author: 1 });
snippetSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Snippet', snippetSchema);