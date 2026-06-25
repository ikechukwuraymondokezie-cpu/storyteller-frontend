const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const User = require('../models/User');
const Novel = require('../models/Novel');
const Snippet = require('../models/Snippet');

/* ─────────────────────────────────────────────────────────────
    GET /api/users/profile
───────────────────────────────────────────────────────────── */

router.get('/profile', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId).select(
            'name email coins currency avatar username bio role ' +
            'savedNovels unlockedNovels purchasedAuvies ' +
            'isSubscribed subscriptionExpiry followers following'
        );

        if (!user) return res.status(404).json({ message: 'User not found' });

        const [publishedNovels, publishedSnippets] = await Promise.all([
            Novel.countDocuments({ author: userId, status: 'published' }),
            Snippet.countDocuments({ author: userId, status: 'published' }),
        ]);

        res.json({
            id:       user._id,
            name:     user.name,
            email:    user.email,
            coins:    user.coins,
            currency: user.currency,
            avatar:   user.avatar,
            username: user.username,
            bio:      user.bio,
            role:     user.role,
            isWriter: (publishedNovels + publishedSnippets) > 0,
            isSubscribed:       user.isSubscribed       ?? false,
            subscriptionExpiry: user.subscriptionExpiry ?? null,
            followersCount: user.followers?.length ?? 0,
            followingCount: user.following?.length ?? 0,
            savedNovels:     user.savedNovels     ?? [],
            unlockedNovels:  user.unlockedNovels  ?? [],
            purchasedAuvies: user.purchasedAuvies ?? [],
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/* ─────────────────────────────────────────────────────────────
    GET /api/users/rankings
    Returns top authors ranked by total views on their novels.
    Public — no auth required.
───────────────────────────────────────────────────────────── */

router.get('/rankings', async (req, res) => {
    try {
        // Aggregate total views per author across all published novels
        const rankings = await Novel.aggregate([
            { $match: { status: 'published' } },
            {
                $group: {
                    _id:        '$author',
                    totalViews: { $sum: '$views' },
                    novelCount: { $sum: 1 },
                    totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
                }
            },
            { $sort: { totalViews: -1 } },
            { $limit: 50 },
            {
                $lookup: {
                    from:         'users',
                    localField:   '_id',
                    foreignField: '_id',
                    as:           'author',
                }
            },
            { $unwind: '$author' },
            {
                $project: {
                    _id:        0,
                    authorId:   '$_id',
                    name:       '$author.name',
                    username:   '$author.username',
                    avatar:     '$author.avatar',
                    totalViews: 1,
                    novelCount: 1,
                    totalLikes: 1,
                }
            },
        ]);

        // Add rank numbers
        const ranked = rankings.map((author, index) => ({
            rank:       index + 1,
            ...author,
            // Format large numbers for display
            reads: _formatCount(author.totalViews),
        }));

        res.json(ranked);
    } catch (err) {
        console.error('Rankings error:', err);
        res.status(500).json({ error: 'Failed to fetch rankings' });
    }
});

function _formatCount(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
}

/* ─────────────────────────────────────────────────────────────
    POST /api/users/save-novel/:novelId
───────────────────────────────────────────────────────────── */

router.post('/save-novel/:novelId', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('savedNovels');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const novelId  = req.params.novelId;
        const savedSet = user.savedNovels.map(id => id.toString());
        const isSaved  = savedSet.includes(novelId);

        if (isSaved) {
            user.savedNovels.pull(novelId);
        } else {
            user.savedNovels.push(novelId);
        }

        await user.save();
        res.json({ saved: !isSaved });
    } catch (err) {
        console.error('Save novel error:', err);
        res.status(500).json({ error: 'Failed to update saved novels' });
    }
});

module.exports = router;