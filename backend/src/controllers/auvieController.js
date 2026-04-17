/* ── AUVIE CONTROLLER ────────────────────────────────────────────────────
 * Business logic lives here. Routes just call these functions.
 * ─────────────────────────────────────────────────────────────────────── */

const path = require('path');
const fs = require('fs-extra');

const Auvie = require('../models/Auvie');
const Novel = require('../models/Novel');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');

const { parseHashtags } = require('../utils/hashtagParser');
const { getAllSoundTags } = require('../utils/soundLibrary');
const { generateSpeech, uploadAudioToCloudinary, fetchElevenLabsVoices } = require('../utils/elevenlabs');

const AUVIE_PURCHASE_PRICE = 200;
const AUVIE_GENERATION_COST = 100;
const PLATFORM_COMMISSION = 0.25;

const tmpDir = path.join(__dirname, '../../temp/auvie');
fs.ensureDirSync(tmpDir);

/* ── GET AVAILABLE SOUNDS ────────────────────────────────────────────── */

exports.getSounds = (req, res) => {
    res.json(getAllSoundTags());
};

/* ── GET AVAILABLE VOICES ────────────────────────────────────────────── */

exports.getVoices = async (req, res) => {
    try {
        const voices = await fetchElevenLabsVoices();
        res.json(voices);
    } catch (err) {
        console.error('ElevenLabs voices error:', err.message);
        res.status(500).json({ error: 'Failed to fetch voices' });
    }
};

/* ── GET SINGLE AUVIE ────────────────────────────────────────────────── */

exports.getAuvie = async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id)
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar');

        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        const userId = req.user._id.toString();
        const isAuthor = auvie.author._id.toString() === userId;
        const hasPurchased = auvie.purchasedBy.map(id => id.toString()).includes(userId);
        const canAccess = isAuthor || hasPurchased;

        res.json({
            _id: auvie._id,
            novel: auvie.novel,
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

/* ── POLL STATUS ─────────────────────────────────────────────────────── */

exports.getStatus = async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id).select('status errorMessage');
        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });
        res.json({ status: auvie.status, errorMessage: auvie.errorMessage });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
};

/* ── DRAFT PREVIEW ───────────────────────────────────────────────────── */
// Returns parsed segments without generating anything — lets the writer
// preview the breakdown before spending coins.

exports.getDraftPreview = async (req, res) => {
    try {
        const novel = await Novel.findOne({ _id: req.params.novelId, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        const allSegments = [];
        for (const chapter of novel.chapters) {
            allSegments.push(...parseHashtags(chapter.content));
        }

        res.json({
            novelId: novel._id,
            title: novel.title,
            segments: allSegments,
            totalCost: AUVIE_GENERATION_COST,
        });
    } catch (err) {
        console.error('Draft preview error:', err.message);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
};

/* ── UPDATE SEGMENTS ─────────────────────────────────────────────────── */
// Author adjusts volume / delay / voiceId per segment from the Workshop UI.

exports.updateSegments = async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id);
        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        if (auvie.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorised to edit this Auvie' });
        }
        if (auvie.status !== 'ready' && auvie.status !== 'generating') {
            return res.status(400).json({ error: 'Cannot edit segments in current state' });
        }

        const { segments: edits, voiceMap } = req.body;
        if (!Array.isArray(edits)) {
            return res.status(400).json({ error: 'segments must be an array' });
        }

        const editMap = {};
        for (const edit of edits) {
            if (typeof edit.order === 'number') editMap[edit.order] = edit;
        }

        const updatedSegments = auvie.segments.map(seg => {
            const edit = editMap[seg.order];
            if (!edit) return seg;
            return {
                ...seg.toObject(),
                volume: typeof edit.volume === 'number' ? Math.min(1, Math.max(0, edit.volume)) : seg.volume,
                delay: typeof edit.delay === 'number' ? Math.min(10000, Math.max(0, Math.round(edit.delay))) : seg.delay,
                voiceId: edit.voiceId !== undefined ? edit.voiceId : seg.voiceId,
            };
        });

        auvie.segments = updatedSegments;
        if (voiceMap && typeof voiceMap === 'object') auvie.voiceMap = voiceMap;
        await auvie.save();

        res.json({ message: 'Segments updated', segments: auvie.segments });
    } catch (err) {
        console.error('Update segments error:', err.message);
        res.status(500).json({ error: 'Failed to update segments' });
    }
};

/* ── GENERATE AUVIE ──────────────────────────────────────────────────── */

exports.generateAuvie = async (req, res) => {
    try {
        const novel = await Novel.findOne({ _id: req.params.novelId, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });
        if (novel.status !== 'published') return res.status(400).json({ error: 'Publish the novel first' });
        if (novel.hasAuvie) return res.status(400).json({ error: 'Auvie already exists for this novel' });

        const user = await User.findById(req.user._id);
        if (user.coins < AUVIE_GENERATION_COST) {
            return res.status(400).json({
                error: 'Insufficient coins',
                required: AUVIE_GENERATION_COST,
                current: user.coins,
            });
        }

        // voiceMap: { "narrator": "elevenLabsVoiceId", "hero": "anotherVoiceId" }
        const voiceMap = req.body.voiceMap || {};
        if (!voiceMap.narrator) {
            voiceMap.narrator = process.env.ELEVENLABS_VOICE_ID || null;
        }

        // Deduct coins immediately
        user.coins -= AUVIE_GENERATION_COST;
        await user.save();

        await CoinTransaction.create({
            user: req.user._id,
            type: 'generate_auvie',
            amount: -AUVIE_GENERATION_COST,
            balanceAfter: user.coins,
            description: `Generated auvie for: ${novel.title}`,
            processor: 'internal',
            relatedNovel: novel._id,
        });

        // Parse all chapters
        const allSegments = [];
        for (const chapter of novel.chapters) {
            allSegments.push(...parseHashtags(chapter.content));
        }

        const auvie = await Auvie.create({
            novel: novel._id,
            author: req.user._id,
            status: 'generating',
            coinPrice: AUVIE_PURCHASE_PRICE,
            generationCost: AUVIE_GENERATION_COST,
            segments: allSegments,
            voiceMap,
        });

        novel.hasAuvie = true;
        novel.auvie = auvie._id;
        await novel.save();

        // Respond immediately — audio generation runs in background
        res.status(202).json({
            message: 'Auvie generation started',
            auvieId: auvie._id,
            status: 'generating',
            segmentCount: allSegments.length,
        });

        // Run background generation without awaiting
        _runBackgroundGeneration(auvie._id, allSegments, voiceMap, user.coins, novel.title, req.user._id);

    } catch (err) {
        console.error('Generate auvie error:', err.message);
        res.status(500).json({ error: 'Failed to start generation' });
    }
};

/* ── BACKGROUND GENERATION (private) ────────────────────────────────── */

async function _runBackgroundGeneration(auvieId, allSegments, voiceMap, userCoinsAtDeduction, novelTitle, userId) {
    const workDir = path.join(tmpDir, auvieId.toString());
    await fs.ensureDir(workDir);

    try {
        const processedSegments = [];

        for (const seg of allSegments) {
            if (seg.type === 'text') {
                try {
                    const audioPath = path.join(workDir, `seg_${seg.order}.mp3`);

                    const resolvedVoiceId =
                        seg.voiceId ||
                        voiceMap[seg.voiceTag] ||
                        voiceMap['narrator'] ||
                        process.env.ELEVENLABS_VOICE_ID;

                    await generateSpeech(seg.value, audioPath, resolvedVoiceId);

                    const audioUrl = await uploadAudioToCloudinary(
                        audioPath,
                        `auvie_${auvieId}_seg_${seg.order}`
                    );

                    await fs.remove(audioPath);
                    processedSegments.push({ ...seg, audioUrl });

                } catch (segErr) {
                    console.error(`Segment ${seg.order} TTS failed:`, segErr.message);
                    // Don't abort — push with null so playback can skip
                    processedSegments.push({ ...seg, audioUrl: null });
                }
            } else {
                // Sound cue — audio URL already resolved by the parser
                processedSegments.push(seg);
            }
        }

        await Auvie.findByIdAndUpdate(auvieId, {
            segments: processedSegments,
            status: 'ready',
        });

        await fs.remove(workDir);
        console.log(`✅ Auvie ${auvieId} ready (${processedSegments.length} segments)`);

    } catch (genErr) {
        console.error(`❌ Auvie ${auvieId} failed:`, genErr.message);

        await Auvie.findByIdAndUpdate(auvieId, {
            status: 'failed',
            errorMessage: genErr.message,
        });

        // Refund coins
        await User.findByIdAndUpdate(userId, { $inc: { coins: AUVIE_GENERATION_COST } });

        await CoinTransaction.create({
            user: userId,
            type: 'generate_auvie',
            amount: AUVIE_GENERATION_COST,
            balanceAfter: userCoinsAtDeduction + AUVIE_GENERATION_COST,
            description: `Refund — auvie generation failed: ${novelTitle}`,
            processor: 'internal',
        });

        if (await fs.pathExists(workDir)) await fs.remove(workDir);
    }
}

/* ── PURCHASE AUVIE ──────────────────────────────────────────────────── */

exports.purchaseAuvie = async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id).populate('novel', 'title');
        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });
        if (auvie.status !== 'ready') return res.status(400).json({ error: 'Auvie not ready yet' });

        if (auvie.purchasedBy.map(id => id.toString()).includes(req.user._id.toString())) {
            return res.status(400).json({ error: 'Already purchased' });
        }

        const user = await User.findById(req.user._id);
        if (user.coins < auvie.coinPrice) {
            return res.status(400).json({
                error: 'Insufficient coins',
                required: auvie.coinPrice,
                current: user.coins,
            });
        }

        const commission = Math.floor(auvie.coinPrice * PLATFORM_COMMISSION);
        const authorEarning = auvie.coinPrice - commission;

        user.coins -= auvie.coinPrice;
        user.purchasedAuvies.push(auvie._id);
        await user.save();

        await User.findByIdAndUpdate(auvie.author, { $inc: { coins: authorEarning } });

        auvie.purchasedBy.push(req.user._id);
        auvie.plays += 1;
        await auvie.save();

        await CoinTransaction.create({
            user: req.user._id,
            type: 'spend_auvie',
            amount: -auvie.coinPrice,
            balanceAfter: user.coins,
            description: `Purchased auvie: ${auvie.novel.title}`,
            processor: 'internal',
            relatedAuvie: auvie._id,
        });

        await CoinTransaction.create({
            user: auvie.author,
            type: 'earn_auvie',
            amount: authorEarning,
            balanceAfter: 0,
            description: `Auvie purchased: ${auvie.novel.title}`,
            processor: 'internal',
            relatedAuvie: auvie._id,
            commission,
        });

        res.json({
            message: 'Auvie purchased',
            coinsRemaining: user.coins,
            segments: auvie.segments,
        });
    } catch (err) {
        console.error('Purchase auvie error:', err.message);
        res.status(500).json({ error: 'Failed to purchase auvie' });
    }
};