const mongoose = require('mongoose');

/**
 * A segment represents a single unit of the Auvie.
 * It is either a block of TTS text or a specific Sound Cue.
 */
const segmentSchema = new mongoose.Schema({
    type: {
        type: String,
        // text: TTS content, oneshot: SFX like #gunshot
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
    // Position in the playback sequence
    order: {
        type: Number,
        required: true
    },

    /* ── WRITER CUSTOMIZATION FIELDS ── */
    // The ElevenLabs Voice ID assigned to this specific text block
    voiceId: {
        type: String,
        default: null
    },
    // The tag used in the novel (e.g., 'narrator', 'hero', 'villain')
    characterName: {
        type: String,
        default: 'narrator'
    },
    // Volume multiplier: 0.0 to 2.0
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
        max: 15
    }
}, { _id: false });

const auvieSchema = new mongoose.Schema({
    novel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: true
    },
    // ── ATTACHMENT TO CHAPTER ──
    // Points to the specific chapter ID within the Novel's chapters array
    chapterId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Permanent Cloudinary URL (if segments are stitched later)
    audioUrl: {
        type: String,
        default: null
    },

    // Map of character tags to Voice IDs (e.g. { "hero": "pNInz..." })
    voiceMap: {
        type: Map,
        of: String,
        default: {}
    },

    duration: {
        type: Number,
        default: 0
    },

    coinPrice: {
        type: Number,
        default: 200
    },

    status: {
        type: String,
        enum: ['pending', 'generating', 'ready', 'failed'],
        default: 'pending'
    },

    errorMessage: {
        type: String,
        default: null
    },

    // The array of segments updated by the Flutter Workshop
    segments: [segmentSchema],

    purchasedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    generationCost: {
        type: Number,
        default: 100
    },

    plays: {
        type: Number,
        default: 0
    },

}, { timestamps: true });

/* ── INDEXING ── */
// Compound index ensures one Auvie per chapter per novel
auvieSchema.index({ novel: 1, chapterId: 1 }, { unique: true });
auvieSchema.index({ author: 1 });
auvieSchema.index({ status: 1 });

module.exports = mongoose.model('Auvie', auvieSchema);