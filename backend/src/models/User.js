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
        select: false // Automatically hides password from API responses
    },
    avatar: {
        type: String,
        default: ""
    },

    // ── F3 PUBLIC FIELDS ──────────────────────────────────────────────────
    username: {
        type: String,
        unique: true,
        sparse: true, // Allows null/undefined until the user sets a unique handle
        lowercase: true,
        trim: true,
        match: [/^[a-zA-Z0-9_]+$/, 'Usernames can only contain letters, numbers, and underscores']
    },
    bio: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        enum: ['reader', 'writer', 'both'],
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
    unlockedNovels: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel'
    }],
    purchasedAuvies: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auvie'
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

/**
 * FIXED: Removed 'next' from the async function signature.
 * Modern Mongoose handles the completion of the hook via the returned Promise.
 * This prevents the "next is not a function" error during .save() calls.
 */
userSchema.pre('save', async function () {
    // If the password field hasn't been changed (e.g., just updating coins), skip hashing
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

/* ── METHODS ─────────────────────────────────────────────────────────── */

// Method to compare password for login
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);