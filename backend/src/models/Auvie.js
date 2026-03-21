const mongoose = require('mongoose');

// A segment is either a text block or a sound cue
const segmentSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['text', 'cue'],
        required: true
    },
    value: { type: String, required: true },
    // For text segments — the ElevenLabs generated audio URL
    audioUrl: { type: String, default: null },
    // Order in the sequence
    order: { type: Number, required: true }
});

const auvieSchema = new mongoose.Schema({
    novel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // The final stitched audio file on Cloudinary
    audioUrl: { type: String, default: null },

    // Duration in seconds
    duration: { type: Number, default: 0 },

    // Platform-set coin price
    coinPrice: { type: Number, default: 200 },

    // Generation status
    status: {
        type: String,
        enum: ['pending', 'generating', 'ready', 'failed'],
        default: 'pending'
    },
    errorMessage: { type: String, default: null },

    // The parsed segments used for generation
    segments: [segmentSchema],

    // Users who have purchased this auvie
    purchasedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // Coins spent by writer to generate (tracks your ElevenLabs cost)
    generationCost: { type: Number, default: 100 },

    // Play count
    plays: { type: Number, default: 0 },

}, { timestamps: true });

auvieSchema.index({ novel: 1 });
auvieSchema.index({ author: 1 });
auvieSchema.index({ status: 1 });

module.exports = mongoose.model('Auvie', auvieSchema);