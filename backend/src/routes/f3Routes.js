const express = require('express');
const router = express.Router();
const Novel = require('../models/Novel');
const Snippet = require('../models/Snippet');
const { Auvie } = require('../models/Auvie');
const User = require('../models/User');
const { protect, optionalProtect } = require('../middleware/authMiddleware');

/* ─────────────────────────────────────────────────────────────
    HELPERS
───────────────────────────────────────────────────────────── */

/**
 * Returns true if the authenticated user is the author of a document.
 * Safely handles both populated objects and raw ObjectId refs.
 */
const isAuthorOf = (doc, userId) => {
    if (!userId) return false;
    const authorId = doc.author?._id
        ? doc.author._id.toString()
        : doc.author?.toString();
    return authorId === userId.toString();
};

/**
 * Builds the novel payload sent to the client.
 * Adds isOwned and isSaved flags when a user is authenticated.
 */
const formatNovel = (novel, user) => {
    const userId = user?._id?.toString();

    return {
        _id: novel._id,
        title: novel.title,
        description: novel.description,
        cover: novel.cover,
        genre: novel.genre,
        author: novel.author,
        totalChapters: novel.totalChapters,
        chapters: novel.chapters,
        hasAuvie: novel.hasAuvie,
        views: novel.views,
        status: novel.status,
        likeCount: novel.likes?.length ?? 0,

        // Tells Flutter: this user wrote it — skip any paywall
        isOwned: userId ? isAuthorOf(novel, userId) : false,

        // Tells Flutter: this user has already paid to unlock it
        isUnlocked: userId
            ? (user.unlockedNovels ?? []).map(id => id.toString()).includes(novel._id.toString())
            : false,

        // Tells Flutter: this user has bookmarked it
        isSaved: userId
            ? (user.savedNovels ?? []).map(id => id.toString()).includes(novel._id.toString())
            : false,
    };
};

/* ─────────────────────────────────────────────────────────────
    F3 MAIN FEED  (public — auth enriches but doesn't block)
───────────────────────────────────────────────────────────── */

router.get('/feed', optionalProtect, async (req, res) => {
    try {
        const [
            featuredNovels,
            trendingNovels,
            staffPicks,
            latestSnippets,
            topAuvies,
        ] = await Promise.all([

            Novel.find({ status: 'published' })
                .populate('author', 'name username avatar')
                .sort({ views: -1 })
                .limit(10),

            Novel.find({ status: 'published' })
                .populate('author', 'name username avatar')
                .sort({ views: -1 })
                .limit(20),

            Novel.find({ status: 'published', staffPick: true })
                .populate('author', 'name username avatar')
                .sort({ createdAt: -1 })
                .limit(10),

            Snippet.find({ status: 'published' })
                .populate('author', 'name username avatar')
                .sort({ createdAt: -1 })
                .limit(10),

            Auvie.find({ status: 'ready' })
                .populate('novel', 'title cover genre author')
                .populate('author', 'name username avatar')
                .sort({ createdAt: -1 })
                .limit(15),
        ]);

        const { user } = req; // may be undefined if not authenticated

        res.json({
            featuredNovels: featuredNovels.map(n => formatNovel(n, user)),
            trendingNovels: trendingNovels.map(n => formatNovel(n, user)),
            staffPicks: staffPicks.map(n => formatNovel(n, user)),

            latestSnippets: latestSnippets.map(s => ({
                _id: s._id,
                title: s.title,
                content: s.content,
                author: s.author,
                plays: s.plays,
                likeCount: s.likes?.length ?? 0,
                duration: s.duration,
            })),

            topAuvies: topAuvies.map(a => {
                const userId = user?._id?.toString();
                const auvieAuthorId = a.author?._id
                    ? a.author._id.toString()
                    : a.author?.toString();
                const novelAuthorId = a.novel?.author?.toString();

                // Owner = the writer who created the auvie, or the novel's author
                const isOwned = userId && (
                    auvieAuthorId === userId || novelAuthorId === userId
                );

                const hasPurchased = userId
                    ? (user.purchasedAuvies ?? []).map(id => id.toString()).includes(a._id.toString())
                    : false;

                return {
                    _id: a._id,
                    chapterId: a.chapterId,
                    novel: a.novel,
                    author: a.author,
                    coinPrice: a.coinPrice,
                    plays: a.plays,
                    duration: a.duration,
                    status: a.status,
                    createdAt: a.createdAt,
                    isOwned: isOwned ?? false,
                    hasPurchased,
                };
            }),
        });

    } catch (err) {
        console.error('F3 Feed Error:', err);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
});

/* ─────────────────────────────────────────────────────────────
    AUVIE PLAYBACK  (protected — must know who the user is)
───────────────────────────────────────────────────────────── */

/**
 * GET /api/f3/auvies/chapter/:chapterId
 *
 * Access rules (first match wins):
 *  1. User is the auvie author                   → free
 *  2. User is the novel's author                 → free
 *  3. Auvie is in user.purchasedAuvies           → free
 *  4. Otherwise                                  → 403 with coinPrice
 */
router.get('/auvies/chapter/:chapterId', protect, async (req, res) => {
    try {
        const auvie = await Auvie.findOne({ chapterId: req.params.chapterId })
            .populate('novel', 'title cover genre author')
            .populate('author', 'name username avatar');

        if (!auvie) {
            return res.status(404).json({ error: 'Auvie not found' });
        }

        const userId = req.user._id.toString();

        const isAuvieAuthor = auvie.author?._id?.toString() === userId;
        const isNovelAuthor = auvie.novel?.author?.toString() === userId;
        const hasPurchased = (req.user.purchasedAuvies ?? [])
            .map(id => id.toString())
            .includes(auvie._id.toString());

        if (!isAuvieAuthor && !isNovelAuthor && !hasPurchased) {
            return res.status(403).json({
                error: 'Purchase required',
                coinPrice: auvie.coinPrice,
                auvieId: auvie._id,
            });
        }

        res.json(auvie);

    } catch (err) {
        console.error('Auvie access error:', err);
        res.status(500).json({ error: 'Failed to load Auvie' });
    }
});

/* ─────────────────────────────────────────────────────────────
    NOVEL CHAPTER ACCESS  (protected)
───────────────────────────────────────────────────────────── */

/**
 * GET /api/f3/novels/:novelId/chapters/:chapterId
 *
 * Access rules (first match wins):
 *  1. User is the novel's author                  → free
 *  2. Novel is in user.unlockedNovels             → free
 *  3. Chapter is marked isFree or order <= 3      → free
 *  4. Otherwise                                   → 403 with coinPrice
 */
router.get('/novels/:novelId/chapters/:chapterId', protect, async (req, res) => {
    try {
        const novel = await Novel.findById(req.params.novelId)
            .populate('author', '_id name username');

        if (!novel) {
            return res.status(404).json({ error: 'Novel not found' });
        }

        const chapter = novel.chapters.id(req.params.chapterId);
        if (!chapter) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const userId = req.user._id.toString();

        const isAuthor = novel.author._id.toString() === userId;
        const hasUnlocked = (req.user.unlockedNovels ?? [])
            .map(id => id.toString())
            .includes(novel._id.toString());
        const isFreeChapter = chapter.isFree === true || (chapter.order ?? Infinity) <= 3;

        if (!isAuthor && !hasUnlocked && !isFreeChapter) {
            return res.status(403).json({
                error: 'Unlock required',
                novelId: novel._id,
                coinPrice: novel.coinPrice ?? 50,
            });
        }

        res.json(chapter);

    } catch (err) {
        console.error('Chapter access error:', err);
        res.status(500).json({ error: 'Failed to load chapter' });
    }
});

/* ─────────────────────────────────────────────────────────────
    SEE ALL NOVELS ENDPOINTS
───────────────────────────────────────────────────────────── */

router.get('/featured', optionalProtect, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const novels = await Novel.find({ status: 'published' })
            .populate('author', 'name username avatar')
            .sort({ views: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({ novels: novels.map(n => formatNovel(n, req.user)) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load featured novels' });
    }
});

router.get('/trending', optionalProtect, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const novels = await Novel.find({ status: 'published' })
            .populate('author', 'name username avatar')
            .sort({ views: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({ novels: novels.map(n => formatNovel(n, req.user)) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load trending novels' });
    }
});

router.get('/staff-picks', optionalProtect, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const novels = await Novel.find({ status: 'published', staffPick: true })
            .populate('author', 'name username avatar')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        res.json({ novels: novels.map(n => formatNovel(n, req.user)) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load staff picks' });
    }
});

/* ─────────────────────────────────────────────────────────────
    SEARCH
───────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────
    USER PROFILE
───────────────────────────────────────────────────────────── */

router.get('/users/:username', async (req, res) => {
    try {
        const user = await User.findOne({
            username: req.params.username.toLowerCase()
        }).select('name username avatar bio role followers following createdAt');

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
                followerCount: user.followers?.length || 0,
                followingCount: user.following?.length || 0,
            },
            novels,
            snippets,
        });

    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

/* ─────────────────────────────────────────────────────────────
    UPDATE PROFILE
───────────────────────────────────────────────────────────── */

router.put('/users/profile', protect, async (req, res) => {
    try {
        const { username, bio, avatar, currency } = req.body;

        if (username) {
            const existing = await User.findOne({
                username: username.toLowerCase(),
                _id: { $ne: req.user._id }
            });

            if (existing) {
                return res.status(400).json({ error: 'Username already taken' });
            }
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

/* ─────────────────────────────────────────────────────────────
    FOLLOW / UNFOLLOW
───────────────────────────────────────────────────────────── */

router.post('/users/:id/follow', protect, async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ error: "Can't follow yourself" });
        }

        const target = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user._id);

        if (!target || !currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

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