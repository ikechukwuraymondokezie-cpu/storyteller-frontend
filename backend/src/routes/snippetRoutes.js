const express = require('express');
const router = express.Router();
const Snippet = require('../models/Snippet');
const User = require('../models/User'); // Import User model for role upgrade
const { protect } = require('../middleware/authMiddleware');

/* ── FEED ────────────────────────────────────────────────────────────── */

// GET /api/f3/snippets — public feed
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        // Note: Filtering by 'published' status
        const snippets = await Snippet.find({ status: 'published' })
            .populate('author', 'name username avatar')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const userId = req.user?._id;
        res.json(snippets.map(s => ({
            _id: s._id,
            title: s.title,
            content: s.content,
            author: s.author,
            audioUrl: s.audioUrl,
            duration: s.duration,
            plays: s.plays,
            likeCount: s.likes.length,
            isLiked: userId
                ? s.likes.map(id => id.toString()).includes(userId.toString())
                : false,
            createdAt: s.createdAt,
        })));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch snippets' });
    }
});

/* ── CREATE (WITH ROLE UPGRADE) ──────────────────────────────────────── */

// POST /api/f3/snippets — Create a new snippet and upgrade reader to writer
router.post('/', protect, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content required' });
        }

        // 1. Create the snippet
        const snippet = await Snippet.create({
            author: req.user._id,
            title,
            content,
            status: 'published' // Ensure it shows up in the feed immediately
        });

        // 2. Upgrade user role to 'writer' if they are currently just a 'reader'
        const user = await User.findById(req.user._id);
        if (user && user.role === 'reader') {
            user.role = 'writer';
            await user.save();
        }

        // 3. Return the populated snippet
        await snippet.populate('author', 'name username avatar');
        res.status(201).json(snippet);
    } catch (err) {
        console.error('Snippet creation error:', err.message);
        res.status(500).json({ error: 'Failed to create snippet' });
    }
});

/* ── LIKE ────────────────────────────────────────────────────────────── */

router.post('/:id/like', protect, async (req, res) => {
    try {
        const snippet = await Snippet.findById(req.params.id);
        if (!snippet) return res.status(404).json({ error: 'Snippet not found' });

        const userId = req.user._id;
        const alreadyLiked = snippet.likes.map(id => id.toString()).includes(userId.toString());

        if (alreadyLiked) {
            snippet.likes = snippet.likes.filter(id => id.toString() !== userId.toString());
        } else {
            snippet.likes.push(userId);
        }

        await snippet.save();
        res.json({ liked: !alreadyLiked, likeCount: snippet.likes.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to like snippet' });
    }
});

/* ── PLAY COUNT ──────────────────────────────────────────────────────── */

router.post('/:id/play', async (req, res) => {
    try {
        await Snippet.findByIdAndUpdate(req.params.id, { $inc: { plays: 1 } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update play count' });
    }
});

/* ── DELETE ──────────────────────────────────────────────────────────── */

router.delete('/:id', protect, async (req, res) => {
    try {
        const snippet = await Snippet.findOneAndDelete({
            _id: req.params.id,
            author: req.user._id
        });
        if (!snippet) return res.status(404).json({ error: 'Snippet not found' });
        res.json({ message: 'Snippet deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete snippet' });
    }
});

module.exports = router;