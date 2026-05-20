const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs-extra');
const path = require('path');
const Novel = require('../models/Novel');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { protect, optionalProtect, requireSubscription } = require('../middleware/authMiddleware');

/* ── CONFIGURATION & MULTER ─────────────────────────────────────────── */

const coverUpload = multer({
    dest: 'temp/covers/',
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg', 'image/jpg', 'image/png',
            'image/x-png', 'image/webp',
            'application/octet-stream',
        ];
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG or WebP images allowed'), false);
        }
    }
});

/* ── ACCESS HELPERS ──────────────────────────────────────────────────── */

/**
 * Determines whether a user can read a specific chapter.
 *
 * Rules:
 *   - Chapter 1 (index 0) → always free for everyone
 *   - Author of the novel → always unrestricted
 *   - Subscribed users    → all chapters
 *   - Everyone else       → chapter 1 only
 */
const canReadChapter = (chapterIndex, userId, novelAuthorId, isSubscribed) => {
    if (chapterIndex === 0) return true;                         // ch1 always free
    if (userId && novelAuthorId.toString() === userId.toString()) return true; // author
    if (isSubscribed) return true;                              // subscriber
    return false;
};

/**
 * Checks whether the current request's user is subscribed.
 * Safe to call even when req.user is null (guest).
 */
const userIsSubscribed = (user) => {
    if (!user) return false;
    return user.isSubscribed &&
        (!user.subscriptionExpiry ||
            new Date(user.subscriptionExpiry) > new Date());
};

/* ── FORMAT HELPERS ──────────────────────────────────────────────────── */

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
    likeCount: novel.likes ? novel.likes.length : 0,
    isLiked: (userId && novel.likes)
        ? novel.likes.some(id => id && id.toString() === userId.toString())
        : false,
    createdAt: novel.createdAt,
    updatedAt: novel.updatedAt,
});

const formatNovelForWriter = (novel, userId) => ({
    ...formatNovelFeed(novel, userId),
    chapters: novel.chapters ? novel.chapters.map(ch => ({
        _id: ch._id,
        title: ch.title,
        order: ch.order,
        wordCount: ch.wordCount,
        createdAt: ch.createdAt,
    })) : [],
});

/**
 * Formats a chapter for the response.
 * content is only included when the reader has access.
 *
 * @param {Object}  chapter
 * @param {number}  index         0-based position in novel.chapters
 * @param {boolean} hasAccess     whether this user can read the content
 */
const formatChapter = (chapter, index, hasAccess) => ({
    _id: chapter._id,
    title: chapter.title,
    order: chapter.order,
    wordCount: chapter.wordCount,
    isFree: index === 0,                    // only ch1 is free
    isLocked: !hasAccess,
    content: hasAccess ? chapter.content : null,
    createdAt: chapter.createdAt,
});

/* ── UPLOAD ROUTE ───────────────────────────────────────────────────── */

router.post('/upload-cover', protect, (req, res, next) => {
    coverUpload.single('cover')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image provided' });

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'novel_covers',
            resource_type: 'image',
            transformation: [
                { width: 1080, height: 1620, crop: 'fill', gravity: 'auto' },
                { quality: '90', fetch_format: 'auto' }
            ]
        });

        await fs.remove(req.file.path);
        res.json({ url: result.secure_url });
    } catch (err) {
        if (req.file?.path) await fs.remove(req.file.path);
        console.error('Cover upload error:', err.message);
        res.status(500).json({ error: 'Cover upload failed' });
    }
});

/* ── FEED & DISCOVERY ────────────────────────────────────────────────── */

router.get('/', optionalProtect, async (req, res) => {
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

        const userId = req.user?._id ?? null;
        res.json(novels.map(n => formatNovelFeed(n, userId)));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch novels' });
    }
});

router.get('/trending', optionalProtect, async (req, res) => {
    try {
        const novels = await Novel.find({ status: 'published' })
            .populate('author', 'name username avatar')
            .sort({ views: -1 })
            .limit(20);

        const userId = req.user?._id ?? null;
        res.json(novels.map(n => formatNovelFeed(n, userId)));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch trending novels' });
    }
});

router.get('/my', protect, async (req, res) => {
    try {
        const novels = await Novel.find({ author: req.user._id })
            .sort({ updatedAt: -1 });
        res.json(novels.map(n => formatNovelForWriter(n, req.user._id)));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch your novels' });
    }
});

/* ── SINGLE NOVEL ────────────────────────────────────────────────────── */

/**
 * GET /novels/:id
 *
 * Returns the novel with chapters formatted according to access rules:
 *   - Chapter 1 content → always included
 *   - Chapter 2+ content → only for author or subscribed users
 *   - isLocked flag tells the client to show a subscription prompt
 */
router.get('/:id', optionalProtect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Novel not found' });
        }

        const novel = await Novel.findById(req.params.id)
            .populate('author', 'name username avatar bio')
            .populate('auvie', 'status coinPrice duration plays');

        if (!novel || novel.status === 'suspended') {
            return res.status(404).json({ error: 'Novel not found' });
        }

        await Novel.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

        const userId = req.user?._id ?? null;
        const isAuthor = userId &&
            novel.author._id.toString() === userId.toString();
        const subscribed = userIsSubscribed(req.user);

        const formattedNovel = formatNovelFeed(novel, userId);
        formattedNovel.chapters = novel.chapters.map((ch, i) => {
            const access = canReadChapter(i, userId, novel.author._id, isAuthor || subscribed);
            return formatChapter(ch, i, access);
        });

        res.json(formattedNovel);
    } catch (err) {
        console.error('Fetch novel error:', err.message);
        res.status(500).json({ error: 'Failed to fetch novel' });
    }
});

/* ── SINGLE CHAPTER ──────────────────────────────────────────────────── */

/**
 * GET /novels/:id/chapters/:chapterId
 *
 * Access rules:
 *   - Chapter 1 → free for everyone
 *   - Author    → always allowed
 *   - Subscribed user → allowed
 *   - Anyone else on chapter 2+ → 403 with subscriptionRequired: true
 */
router.get('/:id/chapters/:chapterId', optionalProtect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Novel not found' });
        }

        const novel = await Novel.findById(req.params.id);
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const chapterIndex = novel.chapters.findIndex(
            ch => ch._id.toString() === req.params.chapterId
        );
        if (chapterIndex === -1) {
            return res.status(404).json({ error: 'Chapter not found' });
        }

        const userId = req.user?._id ?? null;
        const isAuthor = userId && novel.author.toString() === userId.toString();
        const subscribed = userIsSubscribed(req.user);
        const access = canReadChapter(chapterIndex, userId, novel.author, isAuthor || subscribed);

        if (!access) {
            return res.status(403).json({
                subscriptionRequired: true,
                message: 'Subscribe to read beyond Chapter 1.',
            });
        }

        const chapter = novel.chapters[chapterIndex];
        res.json(formatChapter(chapter, chapterIndex, true));
    } catch (err) {
        console.error('Fetch chapter error:', err.message);
        res.status(500).json({ error: 'Failed to fetch chapter' });
    }
});

/* ── LIKE / UNLIKE ───────────────────────────────────────────────────── */

router.post('/:id/like', protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Novel not found' });
        }

        const novel = await Novel.findById(req.params.id);
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const userId = req.user._id;
        const alreadyLiked = novel.likes.some(
            id => id.toString() === userId.toString()
        );

        if (alreadyLiked) {
            novel.likes = novel.likes.filter(
                id => id.toString() !== userId.toString()
            );
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

        if (!title?.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.role === 'reader') {
            user.role = 'writer';
            await user.save();
        }

        const novel = await Novel.create({
            author: req.user._id,
            title: title.trim(),
            description: description?.trim() || "",
            cover: cover || "",
            genre: genre || 'Other',
            tags: tags || [],
            freeChapterCount: freeChapterCount ?? 1,   // default: only ch1 free
            unlockPrice: unlockPrice ?? 50,
            status: 'draft',
        });

        res.status(201).json(novel);
    } catch (err) {
        console.error('Create novel error:', err.message);
        res.status(500).json({ error: 'Failed to create novel', detail: err.message });
    }
});

router.put('/:id', protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Novel not found' });
        }

        const novel = await Novel.findOne({ _id: req.params.id, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const { title, description, cover, genre, tags, freeChapterCount, unlockPrice } = req.body;
        if (title) novel.title = title.trim();
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
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Novel not found' });
        }

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
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Novel not found' });
        }

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
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Novel not found' });
        }

        const novel = await Novel.findOne({ _id: req.params.id, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content required' });
        }

        const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
        const order = novel.chapters.length + 1;

        novel.chapters.push({ title: title.trim(), content, order, wordCount });
        novel.totalChapters = novel.chapters.length;
        await novel.save();

        const savedChapter = novel.chapters[novel.chapters.length - 1];
        res.status(201).json({
            message: 'Chapter added',
            chapter: {
                _id: savedChapter._id,
                title: savedChapter.title,
                order: savedChapter.order,
                wordCount: savedChapter.wordCount,
                createdAt: savedChapter.createdAt,
            },
            totalChapters: novel.totalChapters,
        });
    } catch (err) {
        console.error('Add chapter error:', err.message);
        res.status(500).json({ error: 'Failed to add chapter', detail: err.message });
    }
});

router.put('/:id/chapters/:chapterId', protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Novel not found' });
        }

        const novel = await Novel.findOne({ _id: req.params.id, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const chapter = novel.chapters.id(req.params.chapterId);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

        const { title, content } = req.body;
        if (title) chapter.title = title.trim();
        if (content) {
            chapter.content = content;
            chapter.wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
        }

        await novel.save();
        res.json({ message: 'Chapter updated', chapter });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update chapter' });
    }
});

router.delete('/:id/chapters/:chapterId', protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Novel not found' });
        }

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