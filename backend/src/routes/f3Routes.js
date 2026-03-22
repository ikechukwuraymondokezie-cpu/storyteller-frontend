const express = require('express');
const router = express.Router();
const Novel = require('../models/Novel');
const Snippet = require('../models/Snippet');
const Auvie = require('../models/Auvie');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

/* ── F3 MAIN FEED ────────────────────────────────────────────────────── */

/**
 * GET /api/f3/feed
 * Returns content for the Storyteller public side.
 */
router.get('/feed', async (req, res) => {
    try {
        const [featuredNovels, latestSnippets, topAuvies] = await Promise.all([
            Novel.find({ status: 'published' })
                .populate('author', 'name username avatar')
                .sort({ views: -1 })
                .limit(10),

            Snippet.find({ status: 'published' })
                .populate('author', 'name username avatar')
                .sort({ createdAt: -1 })
                .limit(10),

            Auvie.find({ status: 'ready' })
                .populate('novel', 'title cover genre')
                .populate('author', 'name username avatar')
                .sort({ plays: -1 })
                .limit(10),
        ]);

        res.json({
            featuredNovels: featuredNovels.map(n => ({
                _id: n._id,
                title: n.title,
                cover: n.cover,
                genre: n.genre,
                author: n.author,
                totalChapters: n.totalChapters,
                hasAuvie: n.hasAuvie,
                views: n.views,
                likeCount: n.likes ? n.likes.length : 0,
            })),
            latestSnippets: latestSnippets.map(s => ({
                _id: s._id,
                title: s.title,
                content: s.content,
                author: s.author,
                plays: s.plays,
                likeCount: s.likes ? s.likes.length : 0,
                duration: s.duration,
            })),
            topAuvies: topAuvies.map(a => ({
                _id: a._id,
                novel: a.novel,
                author: a.author,
                coinPrice: a.coinPrice,
                plays: a.plays,
                duration: a.duration,
            })),
        });
    } catch (err) {
        console.error("F3 Feed Error:", err);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
});

/* ── SEARCH ──────────────────────────────────────────────────────────── */

router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Query required' });

        const [novels, users] = await Promise.all([
            Novel.find({
                status: 'published',
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { tags: { $regex: q, $options: 'i' } }
                ]
            })
                .populate('author', 'name username avatar')
                .limit(10),

            User.find({
                $or: [
                    { name: { $regex: q, $options: 'i' } },
                    { username: { $regex: q, $options: 'i' } }
                ]
            })
                .select('name username avatar bio role')
                .limit(10),
        ]);

        res.json({ novels, users });
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
});

/* ── WRITER PROFILES ─────────────────────────────────────────────────── */

router.get('/users/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username.toLowerCase() })
            .select('name username avatar bio role followers following createdAt');

        if (!user) return res.status(404).json({ error: 'User not found' });

        const [novels, snippets] = await Promise.all([
            Novel.find({ author: user._id, status: 'published' })
                .select('title cover genre totalChapters hasAuvie views')
                .sort({ createdAt: -1 }),
            Snippet.find({ author: user._id, status: 'published' })
                .select('title plays likes createdAt')
                .sort({ createdAt: -1 })
        ]);

        res.json({
            user: {
                ...user.toObject(),
                followerCount: user.followers ? user.followers.length : 0,
                followingCount: user.following ? user.following.length : 0,
            },
            novels,
            snippets,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

router.put('/users/profile', protect, async (req, res) => {
    try {
        const { username, bio, avatar, currency } = req.body;

        if (username) {
            const existing = await User.findOne({
                username: username.toLowerCase(),
                _id: { $ne: req.user._id }
            });
            if (existing) return res.status(400).json({ error: 'Username already taken' });
        }

        const updates = {};
        if (username) updates.username = username.toLowerCase();
        if (bio !== undefined) updates.bio = bio;
        if (avatar) updates.avatar = avatar;
        if (currency) updates.currency = currency;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true }
        ).select('name username avatar bio role coins currency');

        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

router.post('/users/:id/follow', protect, async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ error: "Can't follow yourself" });
        }

        const target = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user._id);

        if (!target || !currentUser) return res.status(404).json({ error: 'User not found' });

        const isFollowing = currentUser.following.includes(target._id);

        if (isFollowing) {
            currentUser.following.pull(target._id);
            target.followers.pull(currentUser._id);
        } else {
            currentUser.following.push(target._id);
            target.followers.push(currentUser._id);
        }

        await Promise.all([currentUser.save(), target.save()]);

        res.json({
            following: !isFollowing,
            followerCount: target.followers.length,
        });
    } catch (err) {
        res.status(500).json({ error: 'Operation failed' });
    }
});

module.exports = router;