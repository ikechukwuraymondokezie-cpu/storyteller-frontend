const jwt = require('jsonwebtoken');
const User = require('../models/User');

/* ── protect ─────────────────────────────────────────────────────────────
 * Requires a valid JWT. Returns 401 if missing or invalid.
 * ─────────────────────────────────────────────────────────────────────── */
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            return next();
        } catch (error) {
            console.error("JWT Verify Error:", error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    return res.status(401).json({ message: 'Not authorized, no token' });
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
            req.user = await User.findById(decoded.id).select('-password');
        } catch (error) {
            console.warn("Optional JWT Verify Error:", error.message);
            req.user = null;
        }
    } else {
        req.user = null;
    }
    next();
};

/* ── requireSubscription ─────────────────────────────────────────────────
 * Checks whether req.user has an active subscription.
 * Must be used AFTER protect or optionalProtect (so req.user is set).
 *
 * Usage: router.get('/something', protect, requireSubscription, handler)
 *
 * Returns 403 with { subscriptionRequired: true } if the user is not
 * subscribed, which the Flutter client can intercept to show a paywall.
 * ─────────────────────────────────────────────────────────────────────── */
const requireSubscription = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    // isSubscribed is a boolean field on the User model.
    // subscriptionExpiry is optional — if set, check it hasn't lapsed.
    const subscribed = req.user.isSubscribed &&
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
 * Factory middleware: verifies req.user is the author of a novel.
 * Attach the novel to req.novel so the route handler doesn't refetch it.
 *
 * Usage: router.get('/:id/...',  protect, isAuthorOf(Novel), handler)
 * ─────────────────────────────────────────────────────────────────────── */
const isAuthorOf = (NovelModel) => async (req, res, next) => {
    try {
        const novel = await NovelModel.findById(req.params.id || req.params.novelId);
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