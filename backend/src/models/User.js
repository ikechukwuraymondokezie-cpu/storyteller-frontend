const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    avatar: {
        type: String,
        default: ""
    },

    // ── F3 PUBLIC FIELDS ──────────────────────────────────────────────────
    username: {
        type: String,
        unique: true,
        sparse: true, // allows null for users who haven't set one yet
        lowercase: true,
        trim: true
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
        default: 0
    },
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // Novels this user has unlocked with coins
    unlockedNovels: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel'
    }],
    // Auvies this user has purchased
    purchasedAuvies: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auvie'
    }],
    // Currency preference — determines Paystack vs Stripe
    currency: {
        type: String,
        enum: ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES'],
        default: 'NGN'
    },

}, { timestamps: true });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);