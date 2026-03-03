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
}, { timestamps: true });

/**
 * HASH PASSWORD BEFORE SAVING
 * We removed 'next' to fix the "next is not a function" error.
 * Mongoose automatically handles async functions by waiting for the promise.
 */
userSchema.pre('save', async function () {
    // 'this' refers to the user being saved
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    // NO next() HERE!
});

/**
 * HELPER METHOD: COMPARE PASSWORDS
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);