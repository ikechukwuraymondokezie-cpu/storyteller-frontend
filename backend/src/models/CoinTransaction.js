const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    type: {
        type: String,
        enum: [
            'purchase',      // user bought coins with real money
            'spend_auvie',   // user purchased an auvie
            'spend_novel',   // user unlocked novel chapters
            'earn_auvie',    // writer earned from auvie sale
            'earn_novel',    // writer earned from novel unlock
            'generate_auvie' // writer spent coins to generate auvie
        ],
        required: true
    },

    amount: { type: Number, required: true }, // positive = credit, negative = debit

    balanceAfter: { type: Number, required: true },

    description: { type: String, default: "" },

    // Payment processor reference (for coin purchases)
    processor: {
        type: String,
        enum: ['paystack', 'stripe', 'internal'],
        default: 'internal'
    },
    processorRef: { type: String, default: null }, // Paystack/Stripe payment reference

    // Related content
    relatedNovel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        default: null
    },
    relatedAuvie: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auvie',
        default: null
    },

    // Platform commission taken (for earn transactions)
    commission: { type: Number, default: 0 },

}, { timestamps: true });

coinTransactionSchema.index({ user: 1, createdAt: -1 });
coinTransactionSchema.index({ processorRef: 1 });

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);