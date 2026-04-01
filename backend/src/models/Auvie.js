const mongoose = require('mongoose');

/**
 * A segment represents a single unit of the Auvie.
 * It is either a block of TTS text or a specific Sound Cue (oneshot or loop).
 */
const segmentSchema = new mongoose.Schema({
    type: {
        type: String,
        // Matches the parser logic: text, oneshot, loop_start, loop_stop
        enum: ['text', 'cue', 'oneshot', 'loop_start', 'loop_stop'],
        required: true
    },
    // The actual text content or the name of the sound (e.g., 'explosion')
    value: {
        type: String,
        required: true
    },
    // The Cloudinary URL for the generated TTS or the SFX file
    audioUrl: {
        type: String,
        default: null
    },
    // Position in the playback sequence (crucial for ordering in Flutter)
    order: {
        type: Number,
        required: true
    },

    /* ── WRITER CUSTOMIZATION FIELDS ── */
    // These allow the "Tap to Edit" feature in Flutter to persist changes

    // Volume multiplier: 0.0 (silent) to 2.0 (200% volume)
    volume: {
        type: Number,
        default: 1.0,
        min: 0,
        max: 2
    },
    // Seconds of silence to wait before playing this segment
    delay: {
        type: Number,
        default: 0,
        min: 0,
        max: 15 // Capped at 15s to prevent "broken" user experiences
    }
}, { _id: false }); // Prevents Mongoose from creating extra IDs for every segment

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

    // Optional: Used if you decide to pre-stitch the entire file into one MP3
    audioUrl: {
        type: String,
        default: null
    },

    // Total length of the Auvie in seconds (calculated after generation)
    duration: {
        type: Number,
        default: 0
    },

    // Price for readers to unlock this content
    coinPrice: {
        type: Number,
        default: 200
    },

    // Tracks the background generation state
    status: {
        type: String,
        enum: ['pending', 'generating', 'ready', 'failed'],
        default: 'pending'
    },

    // Captures errors from ElevenLabs or Cloudinary for the writer to see
    errorMessage: {
        type: String,
        default: null
    },

    // The full array of interactive segments (Text + SFX)
    segments: [segmentSchema],

    // List of User IDs who have paid to unlock this Auvie
    purchasedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // How many coins the writer spent to generate this (e.g., 100)
    generationCost: {
        type: Number,
        default: 100
    },

    // Analytics for the writer's dashboard
    plays: {
        type: Number,
        default: 0
    },

}, { timestamps: true });

/* ── INDEXING ── */
// These ensure the app stays fast as your database grows
auvieSchema.index({ novel: 1 });
auvieSchema.index({ author: 1 });
auvieSchema.index({ status: 1 });

module.exports = mongoose.model('Auvie', auvieSchema);