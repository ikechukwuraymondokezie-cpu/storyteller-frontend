const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        select: false
    },
    avatar: {
        type: String,
        default: ''
    },

    // ── F3 PUBLIC FIELDS ──────────────────────────────────────────────────

    username: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        match: [/^[a-zA-Z0-9_]+$/, 'Usernames can only contain letters, numbers, and underscores']
    },
    bio: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        enum: ['reader', 'writer', 'both', 'admin'],
        default: 'reader'
    },
    coins: {
        type: Number,
        default: 0,
        min: 0
    },
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // ── CONTENT ACCESS ────────────────────────────────────────────────────

    /**
     * Novels the user has paid to unlock.
     * Note: if user.id === novel.author, access is always granted
     * regardless of whether the novel appears here.
     */
    unlockedNovels: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel'
    }],

    /**
     * Auvies the user has purchased.
     * Note: if user.id === auvie.author OR novel.author, access is
     * always granted regardless of whether the auvie appears here.
     */
    purchasedAuvies: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auvie'
    }],

    /**
     * Novels the user has bookmarked / saved for later.
     * Purely for UI — does not affect access control.
     */
    savedNovels: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel'
    }],

    currency: {
        type: String,
        enum: ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES'],
        default: 'NGN'
    },

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

/* ── MIDDLEWARE ──────────────────────────────────────────────────────── */

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

/* ── METHODS ─────────────────────────────────────────────────────────── */

userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);