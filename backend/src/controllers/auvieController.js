/* ── AUVIE CONTROLLER ────────────────────────────────────────────────────
 * Full Business Logic for Auvie: Parsing, Background Generation, & Sales.
 * ─────────────────────────────────────────────────────────────────────── */

const path = require('path');
const fs = require('fs-extra');
const mongoose = require('mongoose');

// Models
const Auvie = require('../models/Auvie');
const Novel = require('../models/Novel');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');

// Utilities
const { parseHashtags } = require('../utils/hashtagParser');
const { getAllSoundTags } = require('../utils/soundLibrary');
const {
    generateSpeech,
    uploadAudioToCloudinary,
    fetchElevenLabsVoices
} = require('../utils/elevenLabs');

// Constants
const AUVIE_PURCHASE_PRICE = 200;
const AUVIE_GENERATION_COST = 100;
const PLATFORM_COMMISSION = 0.25;

// ── FREE TIER SAFETY FLAGS ────────────────────────────────────────────
// Set DEV_MODE=true in your Render env vars while testing on free tier.
// Set it to false (or remove it) when you upgrade to a paid ElevenLabs plan.
const DEV_MODE = process.env.DEV_MODE === 'true';

// How long to wait between ElevenLabs calls (ms).
// 3000ms = 3 seconds. Prevents "unusual activity" flag on free tier.
const ELEVENLABS_CALL_DELAY_MS = DEV_MODE ? 3000 : 30000;

// Max characters per segment sent to ElevenLabs in dev mode.
// Keeps you well under the 10k/month free tier limit during testing.
const DEV_MAX_CHARS_PER_SEGMENT = 120;

// Helper — pause execution between API calls
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Local temp directory setup - Using /tmp for better compatibility with Render/Serverless
const tmpDir = path.join('/tmp', 'auvie');
fs.ensureDirSync(tmpDir);

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

exports.getAuvie = async (req, res, next) => {
    try {
        const auvie = await Auvie.findById(req.params.id)
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar');

        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        const userId = req.user._id.toString();
        const isAuthor = auvie.author._id.toString() === userId;
        const hasPurchased = auvie.purchasedBy.some(id => id.toString() === userId);
        const canAccess = isAuthor || hasPurchased;

        res.json({
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
            audioUrl: canAccess ? auvie.audioUrl : null,
            segments: canAccess ? auvie.segments : null,
            createdAt: auvie.createdAt,
        });
    } catch (err) {
        console.error('getAuvie error:', err.message);
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

        const segments = parseHashtags(chapter.content);

        res.json({
            novelId: novel._id,
            chapterId: chapter._id,
            chapterTitle: chapter.title,
            segments: segments,
            totalCost: AUVIE_GENERATION_COST,
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

        // Deduct coins
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

        // Respond immediately so Flutter gets the 202 right away
        res.status(202).json({
            message: 'Generation started',
            auvieId: auvie._id,
            status: 'generating'
        });

        // Fire background worker — NOT awaited
        _runBackgroundWorker(auvie._id, segmentsToProcess, voiceMap, novel.title, req.user._id);

    } catch (err) {
        console.error('generateAuvie error:', err.message);
        return next(err);
    }
};

// ── RETRY + BACKOFF WRAPPER FOR ELEVENLABS ───────────────────────────
async function generateWithRetry(text, audioPath, voiceId, retries = 3) {
    try {
        return await generateSpeech(text, audioPath, voiceId);
    } catch (err) {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail?.status;

        console.error(`[ElevenLabs Retry] Status: ${status}, Detail: ${detail}`);

        // If ElevenLabs flags unusual activity → cooldown
        if (detail === 'detected_unusual_activity') {
            console.log('[Auvie Worker] Cooldown triggered (10s)...');
            await sleep(10000);
        }

        // Retry only for rate/authorization issues
        if (retries > 0 && (status === 401 || status === 429)) {
            const backoff = (4 - retries) * 2000; // 2s → 4s → 6s
            console.log(`[Retry] Waiting ${backoff}ms before retry...`);
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

    if (DEV_MODE) {
        console.log(`[Auvie Worker] DEV_MODE ON — delay: ${ELEVENLABS_CALL_DELAY_MS}ms, max chars: ${DEV_MAX_CHARS_PER_SEGMENT}`);
    }

    try {
        const processedSegments = [];
        let segmentCallCount = 0;

        for (const seg of segments) {
            if (seg.type === 'text') {
                try {
                    const audioPath = path.join(workDir, `seg_${seg.order}.mp3`);

                    // Voice resolution hierarchy:
                    // 1. Segment-level override (set in Workshop)
                    // 2. Character name mapped to a voice (e.g. "John" -> voiceId)
                    // 3. Narrator fallback from voiceMap
                    // 4. Hard fallback to env var
                    const resolvedVoiceId =
                        seg.voiceId ||
                        voiceMap[seg.characterName?.toLowerCase()] ||
                        voiceMap['narrator'] ||
                        process.env.ELEVENLABS_VOICE_ID ||
                        'pNInz6obpg8ndPey74S';

                    // ── FREE TIER: truncate long segments to save quota ──
                    // In DEV_MODE each segment is capped at DEV_MAX_CHARS_PER_SEGMENT
                    // so a 10-segment chapter costs ~1,200 chars instead of ~5,000+
                    const textToSend = DEV_MODE
                        ? seg.value.substring(0, DEV_MAX_CHARS_PER_SEGMENT)
                        : seg.value;

                    console.log(
                        `[Auvie Worker] Segment ${seg.order} — voice: ${resolvedVoiceId} — ${textToSend.length} chars`
                    );

                    // ── RATE LIMIT GUARD ──
                    // Wait before every call EXCEPT the very first one.
                    // This is the main fix for the "detected_unusual_activity" 401.
                    // ── RATE LIMIT + BURST CONTROL ──
                    if (segmentCallCount > 0) {
                        console.log(`[Auvie Worker] Waiting ${ELEVENLABS_CALL_DELAY_MS}ms before next call...`);
                        await sleep(ELEVENLABS_CALL_DELAY_MS);
                    }

                    // Every 5 segments → extra cooldown to avoid detection
                    if (segmentCallCount > 0 && segmentCallCount % 5 === 0) {
                        console.log('[Auvie Worker] Batch cooldown (5s)...');
                        await sleep(5000);
                    }

                    // Use retry wrapper instead of raw call
                    await generateWithRetry(textToSend, audioPath, resolvedVoiceId);

                    // Treat retries as real calls → enforce delay AFTER success
                    segmentCallCount++;

                    // Extra safety: small delay after each successful generation
                    console.log('[Auvie Worker] Post-success cooldown (1s)...');
                    await sleep(1000);

                    const audioUrl = await uploadAudioToCloudinary(
                        audioPath,
                        `auvie_segments/${auvieId}/seg_${seg.order}`
                    );

                    await fs.remove(audioPath);

                    processedSegments.push({
                        ...seg,
                        // Store the full original text (not the truncated version)
                        // so readers always see the complete prose
                        value: seg.value,
                        audioUrl,
                        voiceId: resolvedVoiceId,
                    });

                    console.log(`[Auvie Worker] Segment ${seg.order} done — uploaded: ${audioUrl}`);

                } catch (segErr) {
                    console.error(`[Auvie Worker] Segment ${seg.order} failed:`, segErr.message);
                    // Push with null audioUrl — player will skip this segment gracefully
                    processedSegments.push({ ...seg, audioUrl: null });
                }

            } else {
                // SFX / loop_start / loop_stop — audioUrls already resolved from soundLibrary
                processedSegments.push(seg);
                console.log(`[Auvie Worker] Segment ${seg.order} — SFX: ${seg.value}`);
            }
        }

        console.log(`[Auvie Worker] All segments processed. Saving to DB...`);

        await Auvie.findByIdAndUpdate(auvieId, {
            $set: {
                segments: processedSegments,
                status: 'ready',
                voiceMap: voiceMap,
            }
        });

        await fs.remove(workDir);
        console.log(`[Auvie Worker] Done — Auvie ${auvieId} is ready.`);

    } catch (genErr) {
        console.error('[Auvie Worker] Fatal error:', genErr.message);

        await Auvie.findByIdAndUpdate(auvieId, {
            $set: { status: 'failed', errorMessage: genErr.message }
        });

        // Refund coins
        await User.findByIdAndUpdate(userId, { $inc: { coins: AUVIE_GENERATION_COST } });

        await CoinTransaction.create({
            user: userId,
            type: 'refund',
            amount: AUVIE_GENERATION_COST,
            description: `Refund: Auvie generation failed for "${novelTitle}"`,
        });

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