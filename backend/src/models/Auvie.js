const mongoose = require('mongoose');

/* ── 1. CHARACTER PROFILE MODEL ─────────────────────────────────────────
 * Centralized settings for specific characters within a Novel.
 * ─────────────────────────────────────────────────────────────────────── */
const characterProfileSchema = new mongoose.Schema({
    novel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    voiceId: {
        type: String,
        required: true
    },
    // ElevenLabs specific fine-tuning
    settings: {
        stability: { type: Number, default: 0.5 },
        similarity_boost: { type: Number, default: 0.75 },
        style: { type: Number, default: 0.0 },
        use_speaker_boost: { type: Boolean, default: true }
    },
    avatarUrl: { type: String, default: null },
    description: { type: String, default: '' }
}, { timestamps: true });

// Ensure character names are unique within a single novel
characterProfileSchema.index({ novel: 1, name: 1 }, { unique: true });

/* ── 2. SEGMENT SCHEMA ──────────────────────────────────────────────────
 * Individual units of audio (TTS or SFX).
 * ─────────────────────────────────────────────────────────────────────── */
const segmentSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['text', 'cue', 'oneshot', 'hashtag', 'loop_start', 'loop_stop'],
        required: true
    },
    value: {
        type: String,
        required: true
    },
    audioUrl: {
        type: String,
        default: null
    },
    order: {
        type: Number,
        required: true
    },
    // Audio Metadata for Flutter performance optimization
    metadata: {
        fileSize: { type: Number, default: 0 }, // in bytes
        bitrate: { type: Number, default: 128 }, // in kbps
        mimeType: { type: String, default: 'audio/mpeg' }
    },
    voiceId: {
        type: String,
        default: null
    },
    characterName: {
        type: String,
        default: 'narrator'
    },
    volume: {
        type: Number,
        default: 1.0,
        min: 0,
        max: 2
    },
    delay: {
        type: Number,
        default: 0,
        min: 0,
        max: 15
    }
}, { _id: true }); // Enabled _id to allow targeted debugging of segments

/* ── 3. MAIN AUVIE SCHEMA ─────────────────────────────────────────────── */
const auvieSchema = new mongoose.Schema({
    novel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: true
    },
    chapterId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // References to Character Profiles used in this Auvie
    characters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CharacterProfile'
    }],
    audioUrl: {
        type: String,
        default: null
    },
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
auvieSchema.index({ novel: 1, chapterId: 1 }, { unique: true });
auvieSchema.index({ author: 1 });
auvieSchema.index({ status: 1 });

const CharacterProfile = mongoose.model('CharacterProfile', characterProfileSchema);
const Auvie = mongoose.model('Auvie', auvieSchema);

module.exports = { Auvie, CharacterProfile };