const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs-extra');
const Novel = require('../models/Novel');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { protect } = require('../middleware/authMiddleware');

/* ── CONFIGURATION & MULTER ─────────────────────────────────────────── */

// Multer setup for temporary local storage before Cloudinary upload
const coverUpload = multer({
    dest: 'temp/covers/',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only JPEG, PNG or WebP images allowed'), false);
    }
});

/* ── HELPERS ─────────────────────────────────────────────────────────── */

/**
 * Formats a novel for the feed — strips full chapter content,
 * returns only metadata and preview.
 */
const formatNovelFeed = (novel, userId) => ({
    _id: novel._id,
    title: novel.title,
    description: novel.description,
    cover: novel.cover,
    genre: novel.genre,
    tags: novel.tags,
    author: novel.author,
    status: novel.status,
    totalChapters: novel.totalChapters,
    freeChapterCount: novel.freeChapterCount,
    unlockPrice: novel.unlockPrice,
    hasAuvie: novel.hasAuvie,
    auvie: novel.auvie,
    views: novel.views,
    likeCount: novel.likes.length,
    isLiked: userId ? novel.likes.map(id => id.toString()).includes(userId.toString()) : false,
    createdAt: novel.createdAt,
    updatedAt: novel.updatedAt,
});

/**
 * Formats a chapter — strips content if locked and user hasn't paid.
 */
const formatChapter = (chapter, index, freeCount, hasUnlocked) => ({
    _id: chapter._id,
    title: chapter.title,
    order: chapter.order,
    wordCount: chapter.wordCount,
    isFree: index < freeCount,
    isLocked: index >= freeCount && !hasUnlocked,
    // Only include content if free or unlocked
    content: (index < freeCount || hasUnlocked) ? chapter.content : null,
    createdAt: chapter.createdAt,
});

/* ── UPLOAD ROUTE ───────────────────────────────────────────────────── */

// POST /api/f3/novels/upload-cover — Must be BEFORE /:id
router.post('/upload-cover', protect, coverUpload.single('cover'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image provided' });

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'novel_covers',
            resource_type: 'image',
            transformation: [
                { width: 600, height: 900, crop: 'fill', gravity: 'auto' },
                { quality: 'auto', fetch_format: 'auto' }
            ]
        });

        // Clean up temp file from local server storage
        await fs.remove(req.file.path);

        res.json({ url: result.secure_url });
    } catch (err) {
        console.error('Cover upload error:', err.message);
        res.status(500).json({ error: 'Cover upload failed' });
    }
});

/* ── FEED & DISCOVERY ────────────────────────────────────────────────── */

// GET /api/f3/novels — public feed, no auth required
router.get('/', async (req, res) => {
    try {
        const { genre, search, page = 1, limit = 20 } = req.query;
        const query = { status: 'published' };

        if (genre) query.genre = genre;
        if (search) query.$text = { $search: search };

        const novels = await Novel.find(query)
            .populate('author', 'name username avatar')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const userId = req.user?._id;
        res.json(novels.map(n => formatNovelFeed(n, userId)));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch novels' });
    }
});

// GET /api/f3/novels/trending — sorted by views
router.get('/trending', async (req, res) => {
    try {
        const novels = await Novel.find({ status: 'published' })
            .populate('author', 'name username avatar')
            .sort({ views: -1 })
            .limit(20);

        res.json(novels.map(n => formatNovelFeed(n, req.user?._id)));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch trending novels' });
    }
});

// GET /api/f3/novels/my — writer's own novels (auth required)
router.get('/my', protect, async (req, res) => {
    try {
        const novels = await Novel.find({ author: req.user._id })
            .sort({ updatedAt: -1 });
        res.json(novels.map(n => formatNovelFeed(n, req.user._id)));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch your novels' });
    }
});

/* ── SINGLE NOVEL ────────────────────────────────────────────────────── */

// GET /api/f3/novels/:id — get novel + chapter list
router.get('/:id', async (req, res) => {
    try {
        const novel = await Novel.findById(req.params.id)
            .populate('author', 'name username avatar bio')
            .populate('auvie', 'status coinPrice duration plays');

        if (!novel || novel.status === 'suspended') {
            return res.status(404).json({ error: 'Novel not found' });
        }

        // Increment view count
        await Novel.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

        // Check if user has unlocked this novel
        const userId = req.user?._id;
        const hasUnlocked = userId
            ? (await User.findById(userId).select('unlockedNovels'))
                ?.unlockedNovels?.map(id => id.toString())
                .includes(novel._id.toString())
            : false;

        const formattedNovel = formatNovelFeed(novel, userId);

        // Add chapter list (no content, just metadata + lock status)
        formattedNovel.chapters = novel.chapters.map((ch, i) =>
            formatChapter(ch, i, novel.freeChapterCount, hasUnlocked)
        );

        res.json(formattedNovel);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch novel' });
    }
});

// GET /api/f3/novels/:id/chapters/:chapterId — get single chapter content
router.get('/:id/chapters/:chapterId', async (req, res) => {
    try {
        const novel = await Novel.findById(req.params.id);
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const chapterIndex = novel.chapters.findIndex(
            ch => ch._id.toString() === req.params.chapterId
        );

        if (chapterIndex === -1) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const isFree = chapterIndex < novel.freeChapterCount;

        if (!isFree) {
            if (!req.user) return res.status(401).json({ error: 'Login required' });

            const user = await User.findById(req.user._id).select('unlockedNovels');
            const hasUnlocked = user.unlockedNovels
                .map(id => id.toString())
                .includes(novel._id.toString());

            if (!hasUnlocked) {
                return res.status(403).json({
                    error: 'Chapter locked',
                    unlockPrice: novel.unlockPrice,
                    message: `Spend ${novel.unlockPrice} coins to unlock all chapters`
                });
            }
        }

        const chapter = novel.chapters[chapterIndex];
        res.json(formatChapter(chapter, chapterIndex, novel.freeChapterCount, true));

    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch chapter' });
    }
});

/* ── UNLOCK NOVEL ────────────────────────────────────────────────────── */

router.post('/:id/unlock', protect, async (req, res) => {
    try {
        const novel = await Novel.findById(req.params.id);
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const user = await User.findById(req.user._id);

        if (user.unlockedNovels.map(id => id.toString()).includes(novel._id.toString())) {
            return res.status(400).json({ error: 'Already unlocked' });
        }

        if (user.coins < novel.unlockPrice) {
            return res.status(400).json({
                error: 'Insufficient coins',
                required: novel.unlockPrice,
                current: user.coins
            });
        }

        const commission = Math.floor(novel.unlockPrice * 0.2);
        const authorEarning = novel.unlockPrice - commission;

        user.coins -= novel.unlockPrice;
        user.unlockedNovels.push(novel._id);
        await user.save();

        await User.findByIdAndUpdate(novel.author, {
            $inc: { coins: authorEarning }
        });

        await CoinTransaction.create({
            user: req.user._id,
            type: 'spend_novel',
            amount: -novel.unlockPrice,
            balanceAfter: user.coins,
            description: `Unlocked novel: ${novel.title}`,
            processor: 'internal',
            relatedNovel: novel._id,
        });

        await CoinTransaction.create({
            user: novel.author,
            type: 'earn_novel',
            amount: authorEarning,
            balanceAfter: 0,
            description: `Novel unlocked by reader: ${novel.title}`,
            processor: 'internal',
            relatedNovel: novel._id,
            commission,
        });

        res.json({ message: 'Novel unlocked successfully', coinsRemaining: user.coins });

    } catch (err) {
        res.status(500).json({ error: 'Failed to unlock novel' });
    }
});

/* ── LIKE / UNLIKE ───────────────────────────────────────────────────── */

router.post('/:id/like', protect, async (req, res) => {
    try {
        const novel = await Novel.findById(req.params.id);
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const userId = req.user._id;
        const alreadyLiked = novel.likes.map(id => id.toString()).includes(userId.toString());

        if (alreadyLiked) {
            novel.likes = novel.likes.filter(id => id.toString() !== userId.toString());
        } else {
            novel.likes.push(userId);
        }

        await novel.save();
        res.json({ liked: !alreadyLiked, likeCount: novel.likes.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to like novel' });
    }
});

/* ── WRITER: CREATE & MANAGE ─────────────────────────────────────────── */

router.post('/', protect, async (req, res) => {
    try {
        const { title, description, cover, genre, tags, freeChapterCount, unlockPrice } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const user = await User.findById(req.user._id);
        if (user.role === 'reader') {
            user.role = 'writer';
            await user.save();
        }

        const novel = await Novel.create({
            author: req.user._id,
            title,
            description: description || "",
            cover: cover || "",
            genre: genre || 'Other',
            tags: tags || [],
            freeChapterCount: freeChapterCount ?? 3,
            unlockPrice: unlockPrice ?? 50,
        });

        res.status(201).json(novel);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create novel' });
    }
});

router.put('/:id', protect, async (req, res) => {
    try {
        const novel = await Novel.findOne({ _id: req.params.id, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const { title, description, cover, genre, tags, freeChapterCount, unlockPrice } = req.body;
        if (title) novel.title = title;
        if (description !== undefined) novel.description = description;
        if (cover) novel.cover = cover;
        if (genre) novel.genre = genre;
        if (tags) novel.tags = tags;
        if (freeChapterCount !== undefined) novel.freeChapterCount = freeChapterCount;
        if (unlockPrice !== undefined) novel.unlockPrice = unlockPrice;

        await novel.save();
        res.json(novel);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update novel' });
    }
});

router.post('/:id/publish', protect, async (req, res) => {
    try {
        const novel = await Novel.findOne({ _id: req.params.id, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });
        if (novel.chapters.length === 0) {
            return res.status(400).json({ error: 'Add at least one chapter before publishing' });
        }

        novel.status = 'published';
        await novel.save();
        res.json({ message: 'Novel published', novel });
    } catch (err) {
        res.status(500).json({ error: 'Failed to publish novel' });
    }
});

router.delete('/:id', protect, async (req, res) => {
    try {
        const novel = await Novel.findOneAndDelete({ _id: req.params.id, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });
        res.json({ message: 'Novel deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete novel' });
    }
});

/* ── CHAPTERS ────────────────────────────────────────────────────────── */

router.post('/:id/chapters', protect, async (req, res) => {
    try {
        const novel = await Novel.findOne({ _id: req.params.id, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const { title, content } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

        const wordCount = content.trim().split(/\s+/).length;
        const order = novel.chapters.length + 1;

        novel.chapters.push({ title, content, order, wordCount });
        novel.totalChapters = novel.chapters.length;
        await novel.save();

        res.status(201).json({
            message: 'Chapter added',
            chapter: novel.chapters[novel.chapters.length - 1],
            totalChapters: novel.totalChapters,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add chapter' });
    }
});

router.put('/:id/chapters/:chapterId', protect, async (req, res) => {
    try {
        const novel = await Novel.findOne({ _id: req.params.id, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const chapter = novel.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

        const { title, content } = req.body;
        if (title) chapter.title = title;
        if (content) {
            chapter.content = content;
            chapter.wordCount = content.trim().split(/\s+/).length;
        }

        await novel.save();
        res.json({ message: 'Chapter updated', chapter });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update chapter' });
    }
});

router.delete('/:id/chapters/:chapterId', protect, async (req, res) => {
    try {
        const novel = await Novel.findOne({ _id: req.params.id, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        novel.chapters = novel.chapters.filter(
            ch => ch._id.toString() !== req.params.chapterId
        );
        novel.totalChapters = novel.chapters.length;
        await novel.save();

        res.json({ message: 'Chapter deleted', totalChapters: novel.totalChapters });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete chapter' });
    }
});

module.exports = router;