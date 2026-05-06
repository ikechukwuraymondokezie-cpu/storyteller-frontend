/* ── AUVIE CONTROLLER ────────────────────────────────────────────────────
 * Full Business Logic for Auvie: Parsing, Background Generation, & Sales.
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

// Initialize the static sound library map (#gunshot -> Cloudinary URL)
const soundLibrary = buildSoundLibrary();

// Constants
const AUVIE_PURCHASE_PRICE = 200;
const AUVIE_GENERATION_COST = 100;
const PLATFORM_COMMISSION = 0.25;

// ── FREE TIER SAFETY FLAGS ────────────────────────────────────────────
const DEV_MODE = process.env.DEV_MODE === 'true';
const ELEVENLABS_CALL_DELAY_MS = DEV_MODE ? 3000 : 30000;
const DEV_MAX_CHARS_PER_SEGMENT = 120;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const tmpDir = path.join('/tmp', 'auvie');
fs.ensureDirSync(tmpDir);

/* ── HELPER: FORMAT AUVIE RESPONSE ───────────────────────────────────── */
// Works with or without an authenticated user (userId may be null for public routes)
const formatAuvieResponse = (auvie, userId) => {
    const isAuthor = userId
        ? auvie.author._id.toString() === userId.toString()
        : false;
    const hasPurchased = userId
        ? auvie.purchasedBy.some(id => id.toString() === userId.toString())
        : false;
    const canAccess = isAuthor || hasPurchased;

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
        voiceMap: isAuthor ? auvie.voiceMap : undefined,
        // For public routes (no auth), still return segments so NovelDetailScreen
        // can show chapter list. Access control for actual audio is handled client-side.
        audioUrl: canAccess ? auvie.audioUrl : null,
        segments: auvie.segments,   // Always return segments (audio URLs inside are the gated resource)
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

// Fetch by Auvie Document ID (protected — author/purchaser check)
exports.getAuvie = async (req, res, next) => {
    try {
        const auvie = await Auvie.findById(req.params.id)
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar');

        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        res.json(formatAuvieResponse(auvie, req.user._id));
    } catch (err) {
        console.error('getAuvie error:', err.message);
        return next(err);
    }
};

// ── FIX: Fetch by Chapter ID ──────────────────────────────────────────
// Called by Flutter NovelDetailScreen via GET /api/f3/auvies/chapter/:chapterId
// No auth required — used for public novel detail view.
// Falls back to novel-level Auvie if chapterId doesn't match (treats as chapter 1).
exports.getAuvieByChapter = async (req, res, next) => {
    try {
        const { chapterId } = req.params;

        // 1. Try exact chapter match first
        let auvie = await Auvie.findOne({
            chapterId: chapterId,
            status: 'ready'
        })
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar');

        // 2. If no exact match, find the novel this chapter belongs to,
        //    then return the first ready Auvie for that novel (chapter 1 fallback)
        if (!auvie) {
            const novel = await Novel.findOne({ 'chapters._id': chapterId }).select('_id');
            if (novel) {
                auvie = await Auvie.findOne({
                    novel: novel._id,
                    status: 'ready'
                })
                    .populate('novel', 'title cover')
                    .populate('author', 'name username avatar')
                    .sort({ createdAt: 1 }); // oldest = chapter 1
            }
        }

        if (!auvie) {
            return res.status(404).json({ error: 'No auvie version exists for this chapter' });
        }

        const userId = req.user ? req.user._id : null;
        res.json(formatAuvieResponse(auvie, userId));
    } catch (err) {
        console.error('getAuvieByChapter error:', err.message);
        return next(err);
    }
};

// ── NEW: Fetch by Novel ID ────────────────────────────────────────────
// Called by Flutter when novel-level Auvie lookup is needed.
// Returns the first ready Auvie for the novel (chapter 1).
// GET /api/f3/auvies/novel/:novelId
exports.getAuvieByNovel = async (req, res, next) => {
    try {
        const { novelId } = req.params;

        const auvie = await Auvie.findOne({
            novel: novelId,
            status: 'ready'
        })
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar')
            .sort({ createdAt: 1 });

        if (!auvie) {
            return res.status(404).json({ error: 'No Auvie found for this novel' });
        }

        // ── Auto-assign chapterId if missing ─────────────────────────
        // If the Auvie was generated before chapterId tracking was added,
        // assign it to the first chapter of the novel automatically.
        if (!auvie.chapterId) {
            const novel = await Novel.findById(novelId).select('chapters');
            if (novel && novel.chapters && novel.chapters.length > 0) {
                auvie.chapterId = novel.chapters[0]._id;
                await auvie.save();
                console.log(`[Auvie] Auto-assigned chapterId ${auvie.chapterId} to Auvie ${auvie._id}`);
            }
        }

        const userId = req.user ? req.user._id : null;
        res.json(formatAuvieResponse(auvie, userId));
    } catch (err) {
        console.error('getAuvieByNovel error:', err.message);
        return next(err);
    }
};

exports.getStatus = async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id).select('status errorMessage');
        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });
        res.json({ status: auvie.status, errorMessage: auvie.errorMessage });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
};

/* ── 3. THE WORKSHOP (DRAFTS & EDITS) ────────────────────────────────── */

exports.getDraftPreview = async (req, res) => {
    try {
        const { novelId, chapterId } = req.params;
        const novel = await Novel.findOne({ _id: novelId, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const chapter = novel.chapters.id(chapterId);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

        // Also return any existing Auvie for this novel/chapter
        const existingAuvie = await Auvie.findOne({
            novel: novelId,
            $or: [
                { chapterId: chapterId },
                { chapterId: { $exists: false } }  // catch Auvies created without chapterId
            ]
        }).select('_id status segments');

        const segments = parseHashtags(chapter.content);

        res.json({
            novelId: novel._id,
            chapterId: chapter._id,
            chapterTitle: chapter.title,
            segments: segments,
            totalCost: AUVIE_GENERATION_COST,
            // Include existing auvie info so the workshop knows if one already exists
            auvieId: existingAuvie ? existingAuvie._id : null,
            existingStatus: existingAuvie ? existingAuvie.status : null,
        });
    } catch (err) {
        console.error('getDraftPreview error:', err.message);
        return res.status(500).json({ error: 'Failed to get draft preview' });
    }
};

exports.updateSegments = async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id);
        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        if (auvie.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const { segments: edits, voiceMap } = req.body;
        if (!Array.isArray(edits)) return res.status(400).json({ error: 'Invalid segments' });

        const editMap = {};
        for (const edit of edits) {
            if (typeof edit.order === 'number') editMap[edit.order] = edit;
        }

        auvie.segments.forEach((seg) => {
            const edit = editMap[seg.order];
            if (edit) {
                if (typeof edit.volume === 'number') seg.volume = Math.min(2, Math.max(0, edit.volume));
                if (typeof edit.delay === 'number') seg.delay = Math.min(15, Math.max(0, edit.delay));
                if (edit.voiceId !== undefined) seg.voiceId = edit.voiceId;
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

exports.generateAuvie = async (req, res, next) => {
    try {
        const { novelId, chapterId } = req.params;
        const { segments: workshopSegments, voiceMap: workshopVoiceMap } = req.body;

        const novel = await Novel.findOne({ _id: novelId, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });
        if (novel.status !== 'published') return res.status(400).json({ error: 'Publish novel first' });

        const chapter = novel.chapters.id(chapterId);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

        const user = await User.findById(req.user._id);
        if (user.coins < AUVIE_GENERATION_COST) {
            return res.status(400).json({ error: 'Insufficient coins', current: user.coins });
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

        const auvie = await Auvie.findOneAndUpdate(
            { novel: novelId, chapterId: chapterId },
            {
                $set: {
                    author: req.user._id,
                    // ── FIX: Always explicitly store chapterId ──────────
                    chapterId: chapterId,
                    status: 'generating',
                    coinPrice: AUVIE_PURCHASE_PRICE,
                    generationCost: AUVIE_GENERATION_COST,
                    segments: segmentsToProcess,
                    voiceMap: voiceMap,
                    errorMessage: null
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

        _runBackgroundWorker(auvie._id, segmentsToProcess, voiceMap, novel.title, req.user._id);

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

        if (detail === 'detected_unusual_activity') {
            await sleep(10000);
        }

        if (retries > 0 && (status === 401 || status === 429)) {
            const backoff = (4 - retries) * 2000;
            await sleep(backoff);
            return generateWithRetry(text, audioPath, voiceId, retries - 1);
        }
        throw err;
    }
}

/* ── 5. THE BACKGROUND WORKER (TTS & Processing) ────────────────────── */

async function _runBackgroundWorker(auvieId, segments, voiceMap, novelTitle, userId) {
    const workDir = path.join(tmpDir, auvieId.toString());
    await fs.ensureDir(workDir);

    try {
        const processedSegments = [];
        let segmentCallCount = 0;

        for (const seg of segments) {
            // TYPE: TEXT -> Generate Voice via ElevenLabs
            if (seg.type === 'text') {
                const audioPath = path.join(workDir, `seg_${seg.order}.mp3`);
                const resolvedVoiceId = seg.voiceId || voiceMap[seg.characterName?.toLowerCase()] || voiceMap['narrator'] || 'pNInz6obpg8ndPey74S';
                const textToSend = DEV_MODE ? seg.value.substring(0, DEV_MAX_CHARS_PER_SEGMENT) : seg.value;

                if (segmentCallCount > 0) await sleep(ELEVENLABS_CALL_DELAY_MS);

                await generateWithRetry(textToSend, audioPath, resolvedVoiceId);
                segmentCallCount++;

                const audioUrl = await uploadAudioToCloudinary(audioPath, `auvie_segments/${auvieId}/seg_${seg.order}`);
                await fs.remove(audioPath);

                processedSegments.push({ ...seg, audioUrl, voiceId: resolvedVoiceId });
            }
            // TYPE: HASHTAG -> Map to static Sound Library URL
            else if (seg.type === 'hashtag') {
                const sfxUrl = soundLibrary[seg.value];
                processedSegments.push({
                    ...seg,
                    audioUrl: sfxUrl || null
                });
            }
            // OTHER: e.g., pauses
            else {
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
        await User.findByIdAndUpdate(userId, { $inc: { coins: AUVIE_GENERATION_COST } });
    } finally {
        if (await fs.pathExists(workDir)) await fs.remove(workDir);
    }
}

/* ── 6. COMMERCE (PURCHASING) ────────────────────────────────────────── */

exports.purchaseAuvie = async (req, res, next) => {
    try {
        const auvie = await Auvie.findById(req.params.id).populate('novel', 'title');
        if (!auvie || auvie.status !== 'ready') {
            return res.status(400).json({ error: 'Auvie not available' });
        }

        const userId = req.user._id;

        if (auvie.purchasedBy.some(id => id.toString() === userId.toString())) {
            return res.status(400).json({ error: 'Already owned' });
        }

        const user = await User.findById(userId);
        if (user.coins < auvie.coinPrice) {
            return res.status(400).json({ error: 'Insufficient coins' });
        }

        const commission = Math.floor(auvie.coinPrice * PLATFORM_COMMISSION);
        const authorEarning = auvie.coinPrice - commission;

        user.coins -= auvie.coinPrice;
        user.purchasedAuvies.push(auvie._id);
        await user.save();

        await User.findByIdAndUpdate(auvie.author, { $inc: { coins: authorEarning } });

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