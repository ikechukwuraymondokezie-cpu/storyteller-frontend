/* ── AUVIE CONTROLLER ────────────────────────────────────────────────────
 * Full Business Logic for Auvie: Parsing, Background Generation, & Sales.
 *
 * Access rules:
 *   - Chapter 1 Auvie  → free for everyone (segments always returned)
 *   - Chapter 2+ Auvie → segments null unless purchased or author
 *   - Novel author      → always unrestricted
 * ─────────────────────────────────────────────────────────────────────── */

const path = require('path');
const fs = require('fs-extra');
const mongoose = require('mongoose');

// Models
const { Auvie, CharacterProfile } = require('../models/Auvie');
const Novel = require('../models/Novel');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');

// Utilities
const { parseHashtags } = require('../utils/hashtagParser');
const { getAllSoundTags, buildSoundLibrary } = require('../utils/soundLibrary');
const {
    generateSpeech,
    uploadAudioToCloudinary,
    fetchElevenLabsVoices
} = require('../utils/elevenLabs');

const soundLibrary = buildSoundLibrary();

const AUVIE_PURCHASE_PRICE = 200;
const AUVIE_GENERATION_COST = 100;
const PLATFORM_COMMISSION = 0.25;

const DEV_MODE = process.env.DEV_MODE === 'true';
const ELEVENLABS_CALL_DELAY_MS = DEV_MODE ? 3000 : 30000;
const DEV_MAX_CHARS_PER_SEGMENT = 120;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const tmpDir = path.join('/tmp', 'auvie');
fs.ensureDirSync(tmpDir);

/* ── ACCESS HELPERS ──────────────────────────────────────────────────── */

/**
 * Determines whether this Auvie belongs to chapter 1 of its novel.
 *
 * We fetch the novel separately with only `author` and `chapters._id` so
 * we are NOT depending on the populated novel object having chapters on it
 * (which only happens when the populate includes 'chapters').
 *
 * Returns: { isChapterOne, isAuthor, hasPurchased }
 */
const resolveAccess = async (auvie, userId) => {
    // Fetch the novel with just what we need for access decisions
    const novelId = auvie.novel._id
        ? auvie.novel._id.toString()
        : auvie.novel.toString();

    const novel = await Novel.findById(novelId).select('author chapters._id');

    if (!novel) {
        return { isChapterOne: false, isAuthor: false, hasPurchased: false };
    }

    // Chapter 1 check: does the first chapter's _id match this auvie's chapterId?
    const isChapterOne = novel.chapters.length > 0 &&
        novel.chapters[0]._id.toString() === auvie.chapterId.toString();

    const isAuthor = userId
        ? novel.author.toString() === userId.toString()
        : false;

    const hasPurchased = userId
        ? auvie.purchasedBy.some(id => id.toString() === userId.toString())
        : false;

    return { isChapterOne, isAuthor, hasPurchased };
};

/* ── FORMAT RESPONSE ─────────────────────────────────────────────────── */

/**
 * Builds the API response for an Auvie.
 *
 * segments and audioUrl:
 *   - Chapter 1 → always included (free preview)
 *   - Author    → always included
 *   - Purchased → always included
 *   - Everyone else on ch2+ → null
 */
const formatAuvieResponse = (auvie, access) => {
    const { isChapterOne, isAuthor, hasPurchased } = access;
    const canAccess = isChapterOne || isAuthor || hasPurchased;

    return {
        _id: auvie._id,
        novel: auvie.novel,
        chapterId: auvie.chapterId,
        author: auvie.author,
        status: auvie.status,
        duration: auvie.duration,
        coinPrice: auvie.coinPrice,
        plays: auvie.plays,
        isAuthor,
        hasPurchased,
        isFreePreview: isChapterOne,   // tells the client this is always free
        voiceMap: isAuthor ? auvie.voiceMap : undefined,
        audioUrl: canAccess ? auvie.audioUrl : null,
        segments: canAccess ? auvie.segments : null,
        createdAt: auvie.createdAt,
    };
};

/* ── 1. ASSET DISCOVERY ──────────────────────────────────────────────── */

exports.getVoices = async (req, res, next) => {
    try {
        const rawVoices = await fetchElevenLabsVoices();
        const cleanVoices = rawVoices.map(v => ({
            voice_id: v.voice_id,
            name: v.name,
            preview_url: v.preview_url,
            category: v.category,
            labels: v.labels
        }));
        res.json(cleanVoices);
    } catch (err) {
        console.error('getVoices error:', err.message);
        return next(err);
    }
};

exports.getSounds = async (req, res, next) => {
    try {
        const sounds = getAllSoundTags();
        res.json(sounds);
    } catch (err) {
        console.error('Sound library error:', err.message);
        res.status(500).json({ error: 'Failed to fetch sound library' });
    }
};

/* ── 2. DATA FETCHING & STATUS ───────────────────────────────────────── */

// GET /api/f3/auvies/:id
exports.getAuvie = async (req, res, next) => {
    try {
        const auvie = await Auvie.findById(req.params.id)
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar');

        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        const userId = req.user ? req.user._id : null;
        const access = await resolveAccess(auvie, userId);
        res.json(formatAuvieResponse(auvie, access));
    } catch (err) {
        console.error('getAuvie error:', err.message);
        return next(err);
    }
};

// GET /api/f3/auvies/chapter/:chapterId
// Public route — used by NovelDetailScreen and F3Screen.
// Chapter 1 segments are always returned. Chapter 2+ gated by purchase/author.
exports.getAuvieByChapter = async (req, res, next) => {
    try {
        const { chapterId } = req.params;

        // 1. Exact match by chapterId
        let auvie = await Auvie.findOne({ chapterId, status: 'ready' })
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar');

        // 2. Fallback: find the novel this chapter belongs to,
        //    return its first ready Auvie (legacy support)
        if (!auvie) {
            const novel = await Novel.findOne({ 'chapters._id': chapterId })
                .select('_id');
            if (novel) {
                auvie = await Auvie.findOne({ novel: novel._id, status: 'ready' })
                    .populate('novel', 'title cover')
                    .populate('author', 'name username avatar')
                    .sort({ createdAt: 1 });
            }
        }

        if (!auvie) {
            return res.status(404).json({ error: 'No auvie version exists for this chapter' });
        }

        const userId = req.user ? req.user._id : null;
        const access = await resolveAccess(auvie, userId);
        res.json(formatAuvieResponse(auvie, access));
    } catch (err) {
        console.error('getAuvieByChapter error:', err.message);
        return next(err);
    }
};

// GET /api/f3/auvies/novel/:novelId
// Novel-level fallback — returns the first ready Auvie for the novel.
exports.getAuvieByNovel = async (req, res, next) => {
    try {
        const { novelId } = req.params;

        const auvie = await Auvie.findOne({ novel: novelId, status: 'ready' })
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar')
            .sort({ createdAt: 1 });

        if (!auvie) {
            return res.status(404).json({ error: 'No Auvie found for this novel' });
        }

        // Auto-assign chapterId if missing (legacy data)
        if (!auvie.chapterId) {
            const novel = await Novel.findById(novelId).select('chapters._id');
            if (novel && novel.chapters && novel.chapters.length > 0) {
                auvie.chapterId = novel.chapters[0]._id;
                await auvie.save();
                console.log(`[Auvie] Auto-assigned chapterId ${auvie.chapterId} to Auvie ${auvie._id}`);
            }
        }

        const userId = req.user ? req.user._id : null;
        const access = await resolveAccess(auvie, userId);
        res.json(formatAuvieResponse(auvie, access));
    } catch (err) {
        console.error('getAuvieByNovel error:', err.message);
        return next(err);
    }
};

// GET /api/f3/auvies/novel/:novelId/chapters
// Returns per-chapter Auvie status for BibliographyScreen.
// Protected — author only.
exports.getChapterAuvieStatuses = async (req, res, next) => {
    try {
        const { novelId } = req.params;

        const novel = await Novel.findOne({ _id: novelId, author: req.user._id })
            .select('chapters._id');

        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const auvies = await Auvie.find({ novel: novelId })
            .select('chapterId status _id')
            .lean();

        // Build chapterId → { status, auvieId } map
        // Prefer 'ready' over 'generating' if multiple exist
        const auvieMap = {};
        for (const a of auvies) {
            if (!a.chapterId) continue;
            const key = a.chapterId.toString();
            const existing = auvieMap[key];
            if (!existing ||
                a.status === 'ready' ||
                (a.status === 'generating' && existing.status !== 'ready')) {
                auvieMap[key] = { status: a.status, auvieId: a._id.toString() };
            }
        }

        const result = novel.chapters.map(ch => {
            const key = ch._id.toString();
            const info = auvieMap[key];
            return {
                chapterId: key,
                status: info ? info.status : 'none',
                auvieId: info ? info.auvieId : null,
            };
        });

        res.json(result);
    } catch (err) {
        console.error('getChapterAuvieStatuses error:', err.message);
        return next(err);
    }
};

// GET /api/f3/auvies/:id/status
exports.getStatus = async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id)
            .select('status errorMessage');
        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });
        res.json({ status: auvie.status, errorMessage: auvie.errorMessage });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
};

/* ── 3. THE WORKSHOP (DRAFTS & EDITS) ────────────────────────────────── */

// GET /api/f3/auvies/draft/:novelId/:chapterId
exports.getDraftPreview = async (req, res) => {
    try {
        const { novelId, chapterId } = req.params;

        const novel = await Novel.findOne({ _id: novelId, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const chapter = novel.chapters.id(chapterId);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

        const existingAuvie = await Auvie.findOne({
            novel: novelId,
            chapterId,
        }).select('_id status segments');

        const segments = parseHashtags(chapter.content);

        res.json({
            novelId: novel._id,
            chapterId: chapter._id,
            chapterTitle: chapter.title,
            segments,
            totalCost: AUVIE_GENERATION_COST,
            auvieId: existingAuvie ? existingAuvie._id : null,
            existingStatus: existingAuvie ? existingAuvie.status : null,
        });
    } catch (err) {
        console.error('getDraftPreview error:', err.message);
        return res.status(500).json({ error: 'Failed to get draft preview' });
    }
};

// PUT /api/f3/auvies/:id/segments
exports.updateSegments = async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id);
        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        if (auvie.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const { segments: edits, voiceMap } = req.body;
        if (!Array.isArray(edits)) {
            return res.status(400).json({ error: 'Invalid segments' });
        }

        const editMap = {};
        for (const edit of edits) {
            if (typeof edit.order === 'number') editMap[edit.order] = edit;
        }

        auvie.segments.forEach((seg) => {
            const edit = editMap[seg.order];
            if (edit) {
                if (typeof edit.volume === 'number') {
                    seg.volume = Math.min(2, Math.max(0, edit.volume));
                }
                if (typeof edit.delay === 'number') {
                    seg.delay = Math.min(15, Math.max(0, edit.delay));
                }
                if (edit.voiceId !== undefined) {
                    seg.voiceId = edit.voiceId;
                }
            }
        });

        if (voiceMap) auvie.voiceMap = voiceMap;
        auvie.markModified('segments');
        await auvie.save();

        res.json({ message: 'Segments updated', segments: auvie.segments });
    } catch (err) {
        console.error('updateSegments error:', err.message);
        return res.status(500).json({ error: 'Failed to update segments' });
    }
};

/* ── 4. GENERATION ENGINE ────────────────────────────────────────────── */

// POST /api/f3/auvies/generate/:novelId/:chapterId
exports.generateAuvie = async (req, res, next) => {
    try {
        const { novelId, chapterId } = req.params;
        const { segments: workshopSegments, voiceMap: workshopVoiceMap } = req.body;

        const novel = await Novel.findOne({ _id: novelId, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });
        if (novel.status !== 'published') {
            return res.status(400).json({ error: 'Publish novel first' });
        }

        const chapter = novel.chapters.id(chapterId);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

        const user = await User.findById(req.user._id);
        if (user.coins < AUVIE_GENERATION_COST) {
            return res.status(400).json({
                error: 'Insufficient coins',
                current: user.coins
            });
        }

        const segmentsToProcess = (workshopSegments && workshopSegments.length > 0)
            ? workshopSegments
            : parseHashtags(chapter.content);

        const voiceMap = workshopVoiceMap || {
            narrator: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpg8ndPey74S'
        };

        user.coins -= AUVIE_GENERATION_COST;
        await user.save();

        await CoinTransaction.create({
            user: req.user._id,
            type: 'generate_auvie',
            amount: -AUVIE_GENERATION_COST,
            balanceAfter: user.coins,
            description: `Generated Auvie: ${novel.title} - ${chapter.title}`,
            relatedNovel: novel._id
        });

        // Upsert by novel + chapterId so each chapter gets exactly one Auvie doc
        const auvie = await Auvie.findOneAndUpdate(
            { novel: novelId, chapterId },
            {
                $set: {
                    author: req.user._id,
                    chapterId,
                    status: 'generating',
                    coinPrice: AUVIE_PURCHASE_PRICE,
                    generationCost: AUVIE_GENERATION_COST,
                    segments: segmentsToProcess,
                    voiceMap,
                    errorMessage: null,
                }
            },
            { upsert: true, new: true }
        );

        novel.hasAuvie = true;
        await novel.save();

        res.status(202).json({
            message: 'Generation started',
            auvieId: auvie._id,
            status: 'generating'
        });

        // Fire and forget — runs in background
        _runBackgroundWorker(
            auvie._id,
            segmentsToProcess,
            voiceMap,
            novel.title,
            req.user._id
        );

    } catch (err) {
        console.error('generateAuvie error:', err.message);
        return next(err);
    }
};

async function generateWithRetry(text, audioPath, voiceId, retries = 3) {
    try {
        return await generateSpeech(text, audioPath, voiceId);
    } catch (err) {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail?.status;

        if (detail === 'detected_unusual_activity') await sleep(10000);

        if (retries > 0 && (status === 401 || status === 429)) {
            await sleep((4 - retries) * 2000);
            return generateWithRetry(text, audioPath, voiceId, retries - 1);
        }
        throw err;
    }
}

/* ── 5. BACKGROUND WORKER ────────────────────────────────────────────── */

async function _runBackgroundWorker(auvieId, segments, voiceMap, novelTitle, userId) {
    const workDir = path.join(tmpDir, auvieId.toString());
    await fs.ensureDir(workDir);

    try {
        const processedSegments = [];
        let segmentCallCount = 0;

        for (const seg of segments) {
            if (seg.type === 'text') {
                const audioPath = path.join(workDir, `seg_${seg.order}.mp3`);
                const resolvedVoiceId =
                    seg.voiceId ||
                    voiceMap[seg.characterName?.toLowerCase()] ||
                    voiceMap['narrator'] ||
                    'pNInz6obpg8ndPey74S';

                const textToSend = DEV_MODE
                    ? seg.value.substring(0, DEV_MAX_CHARS_PER_SEGMENT)
                    : seg.value;

                if (segmentCallCount > 0) await sleep(ELEVENLABS_CALL_DELAY_MS);

                await generateWithRetry(textToSend, audioPath, resolvedVoiceId);
                segmentCallCount++;

                const audioUrl = await uploadAudioToCloudinary(
                    audioPath,
                    `auvie_segments/${auvieId}/seg_${seg.order}`
                );
                await fs.remove(audioPath);

                processedSegments.push({ ...seg, audioUrl, voiceId: resolvedVoiceId });

            } else if (seg.type === 'hashtag') {
                const sfxUrl = soundLibrary[seg.value];
                processedSegments.push({ ...seg, audioUrl: sfxUrl || null });

            } else {
                // loop_start, loop_stop, pause, etc.
                processedSegments.push(seg);
            }
        }

        await Auvie.findByIdAndUpdate(auvieId, {
            $set: { segments: processedSegments, status: 'ready', voiceMap }
        });

    } catch (genErr) {
        console.error('[Auvie Worker] Fatal Failure:', genErr.message);
        await Auvie.findByIdAndUpdate(auvieId, {
            $set: { status: 'failed', errorMessage: genErr.message }
        });
        // Refund coins
        await User.findByIdAndUpdate(userId, {
            $inc: { coins: AUVIE_GENERATION_COST }
        });
    } finally {
        if (await fs.pathExists(workDir)) await fs.remove(workDir);
    }
}

/* ── 6. COMMERCE (PURCHASING) ────────────────────────────────────────── */

// POST /api/f3/auvies/:id/purchase
exports.purchaseAuvie = async (req, res, next) => {
    try {
        const auvie = await Auvie.findById(req.params.id)
            .populate('novel', 'title');

        if (!auvie || auvie.status !== 'ready') {
            return res.status(400).json({ error: 'Auvie not available' });
        }

        const userId = req.user._id;
        const access = await resolveAccess(auvie, userId);

        // Author never needs to purchase
        if (access.isAuthor) {
            return res.status(400).json({
                error: 'Authors have free access to their own Auvies'
            });
        }

        // Chapter 1 is always free — no purchase needed
        if (access.isChapterOne) {
            return res.status(400).json({
                error: 'Chapter 1 Auvies are free — no purchase needed'
            });
        }

        // Already purchased
        if (access.hasPurchased) {
            return res.status(400).json({ error: 'Already owned' });
        }

        const user = await User.findById(userId);
        if (user.coins < auvie.coinPrice) {
            return res.status(400).json({ error: 'Insufficient coins' });
        }

        const commission = Math.floor(auvie.coinPrice * PLATFORM_COMMISSION);
        const authorEarning = auvie.coinPrice - commission;

        user.coins -= auvie.coinPrice;
        if (!user.purchasedAuvies) user.purchasedAuvies = [];
        user.purchasedAuvies.push(auvie._id);
        await user.save();

        await User.findByIdAndUpdate(auvie.author, {
            $inc: { coins: authorEarning }
        });

        auvie.purchasedBy.push(userId);
        auvie.plays += 1;
        await auvie.save();

        await CoinTransaction.create({
            user: userId,
            type: 'spend_auvie',
            amount: -auvie.coinPrice,
            balanceAfter: user.coins,
            description: `Purchased Auvie: ${auvie.novel.title}`,
            relatedAuvie: auvie._id
        });

        await CoinTransaction.create({
            user: auvie.author,
            type: 'earn_auvie',
            amount: authorEarning,
            description: `Earnings: Auvie for ${auvie.novel.title}`,
            relatedAuvie: auvie._id
        });

        res.json({
            message: 'Auvie purchased successfully',
            coinsRemaining: user.coins,
            segments: auvie.segments
        });
    } catch (err) {
        console.error('purchaseAuvie error:', err.message);
        return next(err);
    }
};