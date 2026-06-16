const jwt = require('jsonwebtoken');
const User = require('../models/User');

/* ── FIELDS SELECTED ON EVERY AUTH ──────────────────────────────────────
 * MongoDB does not allow mixing exclusions (-field) with inclusions
 * (field) in the same .select() call — except for _id.
 *
 * WRONG:  '-password purchasedAuvies coins'   ← mixed = crash
 * RIGHT:  '-password -__v'                    ← exclusions only
 *
 * password has `select: false` in the schema so it's already hidden
 * by default. We exclude it explicitly here as a safety belt.
 * All other fields (coins, purchasedAuvies, savedNovels, etc.)
 * are returned automatically because we're only excluding, not picking.
 * ─────────────────────────────────────────────────────────────────────── */
const USER_FIELDS = '-password -__v';

/* ── protect ─────────────────────────────────────────────────────────────
 * Requires a valid JWT. Returns 401 if missing or invalid.
 * ─────────────────────────────────────────────────────────────────────── */
const protect = async (req, res, next) => {
    if (!req.headers.authorization?.startsWith('Bearer')) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select(USER_FIELDS);

        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }

        return next();
    } catch (error) {
        console.error('JWT Verify Error:', error.message);
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

/* ── optionalProtect ─────────────────────────────────────────────────────
 * Identifies the user if a token is present, but never blocks the request.
 * req.user is null for guests.
 * ─────────────────────────────────────────────────────────────────────── */
const optionalProtect = async (req, res, next) => {
    if (req.headers.authorization?.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select(USER_FIELDS);
        } catch (error) {
            console.warn('Optional JWT Verify Error:', error.message);
            req.user = null;
        }
    } else {
        req.user = null;
    }
    next();
};

/* ── requireSubscription ─────────────────────────────────────────────────
 * Must be used AFTER protect or optionalProtect.
 * ─────────────────────────────────────────────────────────────────────── */
const requireSubscription = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const subscribed =
        req.user.isSubscribed &&
        (!req.user.subscriptionExpiry ||
            new Date(req.user.subscriptionExpiry) > new Date());

    if (!subscribed) {
        return res.status(403).json({
            subscriptionRequired: true,
            message: 'An active subscription is required to access this content.',
        });
    }

    next();
};

/* ── isAuthorOf ──────────────────────────────────────────────────────────
 * Factory middleware: verifies req.user is the author of a document.
 * Usage: router.get('/:id/...', protect, isAuthorOf(Novel), handler)
 * ─────────────────────────────────────────────────────────────────────── */
const isAuthorOf = (NovelModel) => async (req, res, next) => {
    try {
        const novel = await NovelModel.findById(
            req.params.id || req.params.novelId
        );
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        if (novel.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized — author only' });
        }

        req.novel = novel;
        next();
    } catch (err) {
        res.status(500).json({ error: 'Authorization check failed' });
    }
};

module.exports = { protect, optionalProtect, requireSubscription, isAuthorOf };