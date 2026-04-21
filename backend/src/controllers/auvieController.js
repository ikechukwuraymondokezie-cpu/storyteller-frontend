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

// Local temp directory setup - Using /tmp for better compatibility with Render/Serverless
const tmpDir = path.join('/tmp', 'auvie');
fs.ensureDirSync(tmpDir);

/* ── 1. ASSET DISCOVERY ──────────────────────────────────────────────── */

exports.getVoices = async (req, res) => {
    try {
        const rawVoices = await fetchElevenLabsVoices();

        // Enrichment: Provide enough data for the Flutter Workshop UI
        const cleanVoices = rawVoices.map(v => ({
            voice_id: v.voice_id,
            name: v.name,
            preview_url: v.preview_url,
            category: v.category, // e.g., 'cloned', 'generated', 'professional'
            labels: v.labels
        }));

        res.json(cleanVoices);
    } catch (err) {
        console.error('ElevenLabs voices error:', err.message);
        res.status(500).json({ error: 'Failed to fetch voices' });
    }
};

/* ── 2. DATA FETCHING & STATUS ───────────────────────────────────────── */

exports.getAuvie = async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id)
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar');

        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        const userId = req.user._id.toString();
        // Fix: Author comparison using ._id after population
        const isAuthor = auvie.author._id.toString() === userId;
        // Fix: Explicitly stringify IDs for comparison
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
        console.error('Fetch auvie error:', err.message);
        res.status(500).json({ error: 'Failed to fetch auvie' });
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
        console.error('Draft preview error:', err.message);
        res.status(500).json({ error: 'Failed to generate preview' });
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

        // Fix: Use .set() and markModified for complex subdocument updates
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
        console.error('Update segments error:', err.message);
        res.status(500).json({ error: 'Failed to update segments' });
    }
};

/* ── 4. GENERATION ENGINE ────────────────────────────────────────────── */

exports.generateAuvie = async (req, res) => {
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

        // Logic: Use segments from Flutter workshop if provided, else parse fresh
        const segmentsToProcess = (workshopSegments && workshopSegments.length > 0)
            ? workshopSegments
            : parseHashtags(chapter.content);

        const voiceMap = workshopVoiceMap || { narrator: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpg8ndPey74S' };

        // 1. Transaction: Deduct coins
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

        // 2. Database Record: Use $set with findOneAndUpdate to avoid versioning conflicts
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

        // 3. Respond immediately
        res.status(202).json({
            message: 'Generation started',
            auvieId: auvie._id,
            status: 'generating'
        });

        // 4. Trigger Background Worker
        _runBackgroundWorker(auvie._id, segmentsToProcess, voiceMap, novel.title, req.user._id);

    } catch (err) {
        console.error('Generate error:', err.message);
        res.status(500).json({ error: 'Failed to start generation' });
    }
};

/* ── 5. THE BACKGROUND WORKER (TTS & Processing) ───────────────────── */

async function _runBackgroundWorker(auvieId, segments, voiceMap, novelTitle, userId) {
    const workDir = path.join(tmpDir, auvieId.toString());
    await fs.ensureDir(workDir);

    try {
        const processedSegments = [];

        for (const seg of segments) {
            if (seg.type === 'text') {
                try {
                    const audioPath = path.join(workDir, `seg_${seg.order}.mp3`);

                    // IMPROVED HIERARCHY: 
                    // 1. Specific segment override (from Workshop)
                    // 2. Character mapping (e.g., 'John' -> 'voiceId123')
                    // 3. Narrator fallback
                    const resolvedVoiceId = seg.voiceId ||
                        voiceMap[seg.characterName?.toLowerCase()] ||
                        voiceMap['narrator'];

                    // Generate the audio file
                    await generateSpeech(seg.value, audioPath, resolvedVoiceId);

                    // Upload to Cloudinary
                    const audioUrl = await uploadAudioToCloudinary(
                        audioPath,
                        `auvie_segments/${auvieId}/seg_${seg.order}`
                    );

                    await fs.remove(audioPath);
                    processedSegments.push({ ...seg, audioUrl, voiceId: resolvedVoiceId });
                } catch (segErr) {
                    console.error(`Segment ${seg.order} failed:`, segErr.message);
                    // We push with null audioUrl so the UI knows this segment is broken
                    processedSegments.push({ ...seg, audioUrl: null });
                }
            } else {
                // SFX segments already have audioUrls from your sound library
                processedSegments.push(seg);
            }
        }

        // Finalize Record
        await Auvie.findByIdAndUpdate(auvieId, {
            $set: {
                segments: processedSegments,
                status: 'ready',
                voiceMap: voiceMap // Store the map used for future reference
            }
        });

        await fs.remove(workDir);

    } catch (genErr) {
        console.error('Background generation failed:', genErr.message);
        // Refund and failure logic remains as you wrote it—it's perfect.
        await Auvie.findByIdAndUpdate(auvieId, {
            $set: { status: 'failed', errorMessage: genErr.message }
        });

        await User.findByIdAndUpdate(userId, { $inc: { coins: AUVIE_GENERATION_COST } });
        await CoinTransaction.create({
            user: userId,
            type: 'refund',
            amount: AUVIE_GENERATION_COST,
            description: `Refund: Auvie failed for ${novelTitle}`,
        });

        if (await fs.pathExists(workDir)) await fs.remove(workDir);
    }
}

/* ── 6. COMMERCE (PURCHASING) ────────────────────────────────────────── */

exports.purchaseAuvie = async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id).populate('novel', 'title');
        if (!auvie || auvie.status !== 'ready') return res.status(400).json({ error: 'Auvie not available' });

        const userId = req.user._id;
        // Fix: Check for purchase using .toString() logic
        if (auvie.purchasedBy.some(id => id.toString() === userId.toString())) {
            return res.status(400).json({ error: 'Already owned' });
        }

        const user = await User.findById(userId);
        if (user.coins < auvie.coinPrice) return res.status(400).json({ error: 'Insufficient coins' });

        const commission = Math.floor(auvie.coinPrice * PLATFORM_COMMISSION);
        const authorEarning = auvie.coinPrice - commission;

        // Transactions
        user.coins -= auvie.coinPrice;
        user.purchasedAuvies.push(auvie._id);
        await user.save();

        await User.findByIdAndUpdate(auvie.author, { $inc: { coins: authorEarning } });

        auvie.purchasedBy.push(userId);
        auvie.plays += 1;
        await auvie.save();

        // Logs
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
        console.error('Purchase error:', err.message);
        res.status(500).json({ error: 'Purchase failed' });
    }
};