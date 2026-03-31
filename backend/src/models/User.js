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
        select: false // Automatically hides password from API responses for security
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
    toJSON: { virtuals: true }, // Ensures populated fields show up in Flutter
    toObject: { virtuals: true } 
});

// Middleware to hash password
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password for login
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);