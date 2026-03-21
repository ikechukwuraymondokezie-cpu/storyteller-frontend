const express = require('express');
const router = express.Router();
const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { protect } = require('../middleware/authMiddleware');

/* ── COIN PACKAGES ───────────────────────────────────────────────────── */

// Platform-defined coin packages
// NGN prices for Paystack, USD prices for Stripe
const COIN_PACKAGES = [
    { id: 'starter', coins: 100, ngnPrice: 500, usdPrice: 0.99 },
    { id: 'basic', coins: 300, ngnPrice: 1200, usdPrice: 2.99 },
    { id: 'standard', coins: 700, ngnPrice: 2500, usdPrice: 6.99 },
    { id: 'premium', coins: 1500, ngnPrice: 5000, usdPrice: 14.99 },
    { id: 'pro', coins: 3500, ngnPrice: 10000, usdPrice: 29.99 },
];

/* ── GET PACKAGES & BALANCE ──────────────────────────────────────────── */

// GET /api/f3/coins/packages — get available coin packages
router.get('/packages', (req, res) => {
    res.json(COIN_PACKAGES);
});

// GET /api/f3/coins/balance — get current coin balance
router.get('/balance', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('coins');
        res.json({ coins: user.coins });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

// GET /api/f3/coins/history — coin transaction history
router.get('/history', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const transactions = await CoinTransaction.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

/* ── PAYSTACK (Nigerian users — NGN) ─────────────────────────────────── */

/**
 * POST /api/f3/coins/paystack/initiate
 * Initiates a Paystack payment for a coin package.
 * Returns a Paystack authorization URL to redirect the user to.
 */
router.post('/paystack/initiate', protect, async (req, res) => {
    try {
        const { packageId } = req.body;
        const pkg = COIN_PACKAGES.find(p => p.id === packageId);
        if (!pkg) return res.status(400).json({ error: 'Invalid package' });

        const user = await User.findById(req.user._id);

        // Paystack expects amount in kobo (NGN * 100)
        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email: user.email,
                amount: pkg.ngnPrice * 100,
                currency: 'NGN',
                metadata: {
                    userId: user._id.toString(),
                    packageId: pkg.id,
                    coins: pkg.coins,
                    platform: 'f3_coins'
                },
                callback_url: `${process.env.APP_URL}/api/f3/coins/paystack/verify`,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        res.json({
            authorizationUrl: response.data.data.authorization_url,
            reference: response.data.data.reference,
        });

    } catch (err) {
        console.error('Paystack initiate error:', err.message);
        res.status(500).json({ error: 'Failed to initiate payment' });
    }
});

/**
 * GET /api/f3/coins/paystack/verify?reference=xxx
 * Called after Paystack redirects back.
 * Verifies the payment and credits coins.
 */
router.get('/paystack/verify', async (req, res) => {
    try {
        const { reference } = req.query;
        if (!reference) return res.status(400).json({ error: 'Reference required' });

        // Check not already processed
        const existing = await CoinTransaction.findOne({ processorRef: reference });
        if (existing) return res.status(400).json({ error: 'Already processed' });

        // Verify with Paystack
        const response = await axios.get(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
            }
        );

        const txData = response.data.data;
        if (txData.status !== 'success') {
            return res.status(400).json({ error: 'Payment not successful' });
        }

        const { userId, packageId, coins } = txData.metadata;
        const pkg = COIN_PACKAGES.find(p => p.id === packageId);
        if (!pkg) return res.status(400).json({ error: 'Invalid package in metadata' });

        // Credit coins
        const user = await User.findByIdAndUpdate(
            userId,
            { $inc: { coins: pkg.coins } },
            { new: true }
        );

        await CoinTransaction.create({
            user: userId,
            type: 'purchase',
            amount: pkg.coins,
            balanceAfter: user.coins,
            description: `Purchased ${pkg.coins} coins via Paystack`,
            processor: 'paystack',
            processorRef: reference,
        });

        res.json({
            message: `${pkg.coins} coins added successfully`,
            coins: user.coins
        });

    } catch (err) {
        console.error('Paystack verify error:', err.message);
        res.status(500).json({ error: 'Verification failed' });
    }
});

/**
 * POST /api/f3/coins/paystack/webhook
 * Paystack webhook for server-to-server payment confirmation.
 * More reliable than the redirect callback.
 */
router.post('/paystack/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const crypto = require('crypto');
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            return res.status(401).send('Invalid signature');
        }

        const event = req.body;

        if (event.event === 'charge.success') {
            const txData = event.data;
            const { userId, packageId, coins, platform } = txData.metadata;

            if (platform !== 'f3_coins') return res.sendStatus(200);

            // Idempotency check
            const existing = await CoinTransaction.findOne({
                processorRef: txData.reference
            });
            if (existing) return res.sendStatus(200);

            const pkg = COIN_PACKAGES.find(p => p.id === packageId);
            if (!pkg) return res.sendStatus(200);

            const user = await User.findByIdAndUpdate(
                userId,
                { $inc: { coins: pkg.coins } },
                { new: true }
            );

            await CoinTransaction.create({
                user: userId,
                type: 'purchase',
                amount: pkg.coins,
                balanceAfter: user.coins,
                description: `Purchased ${pkg.coins} coins via Paystack`,
                processor: 'paystack',
                processorRef: txData.reference,
            });
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Paystack webhook error:', err.message);
        res.sendStatus(500);
    }
});

/* ── STRIPE (International users — USD) ─────────────────────────────── */

/**
 * POST /api/f3/coins/stripe/initiate
 * Creates a Stripe Payment Intent.
 * Returns clientSecret for Flutter to complete payment with Stripe SDK.
 */
router.post('/stripe/initiate', protect, async (req, res) => {
    try {
        const { packageId } = req.body;
        const pkg = COIN_PACKAGES.find(p => p.id === packageId);
        if (!pkg) return res.status(400).json({ error: 'Invalid package' });

        const user = await User.findById(req.user._id);

        // Stripe expects amount in cents (USD * 100)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(pkg.usdPrice * 100),
            currency: 'usd',
            metadata: {
                userId: user._id.toString(),
                packageId: pkg.id,
                coins: pkg.coins.toString(),
                platform: 'f3_coins'
            },
            receipt_email: user.email,
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        });

    } catch (err) {
        console.error('Stripe initiate error:', err.message);
        res.status(500).json({ error: 'Failed to initiate payment' });
    }
});

/**
 * POST /api/f3/coins/stripe/webhook
 * Stripe webhook — credits coins after successful payment.
 */
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type === 'payment_intent.succeeded') {
            const intent = event.data.object;
            const { userId, packageId, platform } = intent.metadata;

            if (platform !== 'f3_coins') return res.sendStatus(200);

            // Idempotency check
            const existing = await CoinTransaction.findOne({
                processorRef: intent.id
            });
            if (existing) return res.sendStatus(200);

            const pkg = COIN_PACKAGES.find(p => p.id === packageId);
            if (!pkg) return res.sendStatus(200);

            const user = await User.findByIdAndUpdate(
                userId,
                { $inc: { coins: pkg.coins } },
                { new: true }
            );

            await CoinTransaction.create({
                user: userId,
                type: 'purchase',
                amount: pkg.coins,
                balanceAfter: user.coins,
                description: `Purchased ${pkg.coins} coins via Stripe`,
                processor: 'stripe',
                processorRef: intent.id,
            });
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Stripe webhook error:', err.message);
        res.sendStatus(500);
    }
});

/* ── NAMED WEBHOOK EXPORTS ───────────────────────────────────────────────
 * These are used directly in server.js with express.raw() BEFORE
 * express.json() is registered — required for signature verification.
 * ─────────────────────────────────────────────────────────────────────── */

const paystackWebhook = async (req, res) => {
    try {
        const crypto = require('crypto');
        const hash = crypto
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            return res.status(401).send('Invalid signature');
        }

        const event = req.body;
        if (event.event === 'charge.success') {
            const txData = event.data;
            const { userId, packageId, platform } = txData.metadata;
            if (platform !== 'f3_coins') return res.sendStatus(200);

            const existing = await CoinTransaction.findOne({ processorRef: txData.reference });
            if (existing) return res.sendStatus(200);

            const pkg = COIN_PACKAGES.find(p => p.id === packageId);
            if (!pkg) return res.sendStatus(200);

            const user = await User.findByIdAndUpdate(
                userId,
                { $inc: { coins: pkg.coins } },
                { new: true }
            );

            await CoinTransaction.create({
                user: userId,
                type: 'purchase',
                amount: pkg.coins,
                balanceAfter: user.coins,
                description: `Purchased ${pkg.coins} coins via Paystack`,
                processor: 'paystack',
                processorRef: txData.reference,
            });
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Paystack webhook error:', err.message);
        res.sendStatus(500);
    }
};

const stripeWebhook = async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type === 'payment_intent.succeeded') {
            const intent = event.data.object;
            const { userId, packageId, platform } = intent.metadata;
            if (platform !== 'f3_coins') return res.sendStatus(200);

            const existing = await CoinTransaction.findOne({ processorRef: intent.id });
            if (existing) return res.sendStatus(200);

            const pkg = COIN_PACKAGES.find(p => p.id === packageId);
            if (!pkg) return res.sendStatus(200);

            const user = await User.findByIdAndUpdate(
                userId,
                { $inc: { coins: pkg.coins } },
                { new: true }
            );

            await CoinTransaction.create({
                user: userId,
                type: 'purchase',
                amount: pkg.coins,
                balanceAfter: user.coins,
                description: `Purchased ${pkg.coins} coins via Stripe`,
                processor: 'stripe',
                processorRef: intent.id,
            });
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('Stripe webhook error:', err.message);
        res.sendStatus(500);
    }
};

module.exports = router;
module.exports.paystackWebhook = paystackWebhook;
module.exports.stripeWebhook = stripeWebhook;