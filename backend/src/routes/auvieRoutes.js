const express = require('express');
const router = express.Router();
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const Novel = require('../models/Novel');
const Auvie = require('../models/Auvie');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { protect } = require('../middleware/authMiddleware');

/* ── CONSTANTS ───────────────────────────────────────────────────────── */

const AUVIE_PURCHASE_PRICE = 200;
const AUVIE_GENERATION_COST = 100;
const PLATFORM_COMMISSION = 0.25;

const tmpDir = path.join(__dirname, '../../temp/auvie');
fs.ensureDirSync(tmpDir);

/* ── SOUND LIBRARY ───────────────────────────────────────────────────── */
// All URLs are live Cloudinary uploads.
// Multiple variants (rain001, rain002...) are randomly selected at parse time
// so the same tag sounds slightly different each time it's used.

const SOUND_VARIANTS = {
    // ── ACTION ────────────────────────────────────────────────────────
    gunshot: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827783/sfx/action/gunshot001.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827781/sfx/action/canonshot001.wav',
    ],
    explosion: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827786/sfx/action/stoneimpact001.wav',
    ],
    sword_clash: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827784/sfx/action/industriallever001.wav',
    ],
    mechanism: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827785/sfx/action/mechanism001.wav',
    ],

    // ── ATMOSPHERE ────────────────────────────────────────────────────
    rain: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827807/sfx/atmosphere/rain001.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827818/sfx/atmosphere/rain002.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827823/sfx/atmosphere/rain003.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827829/sfx/atmosphere/rain004.wav',
    ],
    thunder: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827835/sfx/atmosphere/thunder001.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827841/sfx/atmosphere/thunder002.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827848/sfx/atmosphere/thunder003.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827855/sfx/atmosphere/thunder004.wav',
    ],
    water_splash: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827857/sfx/atmosphere/waterimpact001.wav',
    ],
    wave: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827873/sfx/atmosphere/wave001.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827881/sfx/atmosphere/wave002.wav',
    ],
    stream: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827805/sfx/atmosphere/gentlestream001.wav',
    ],
    boiling_water: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827792/sfx/atmosphere/boilingwater001.wav',
    ],
    electricity: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827800/sfx/atmosphere/electricity001.wav',
    ],
    steampunk: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827831/sfx/atmosphere/steampunkmechanism001.wav',
    ],

    // ── TRANSITION ────────────────────────────────────────────────────
    impact: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827883/sfx/Transition/impact%20001.wav',
    ],
    whoosh: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827885/sfx/Transition/somethingmoved001.wav',
    ],
    clock: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827892/sfx/Transition/clocktick001.wav',
    ],
};

// Pick a random variant from an array
function pickVariant(variants) {
    if (!variants || variants.length === 0) return null;
    return variants[Math.floor(Math.random() * variants.length)];
}

// Flat SOUND_LIBRARY for hashtag lookup — maps tag name → picked URL
// Built dynamically so each call to parseHashtags gets fresh random picks
function buildSoundLibrary() {
    const lib = {};
    for (const [key, variants] of Object.entries(SOUND_VARIANTS)) {
        lib[key] = pickVariant(variants);
    }
    // Aliases — loop variants share the same key as their base
    lib['rain_start'] = pickVariant(SOUND_VARIANTS.rain);
    lib['rain_stop'] = null;
    lib['thunder_start'] = pickVariant(SOUND_VARIANTS.thunder);
    lib['thunder_stop'] = null;
    return lib;
}

/* ── HASHTAG PARSER ──────────────────────────────────────────────────── */

function parseHashtags(content) {
    const SOUND_LIBRARY = buildSoundLibrary();
    const tagPattern = /#([a-z][a-z0-9_]*)/gi;
    const parts = content.split(tagPattern);
    const segments = [];
    let order = 0;

    const seenTags = new Set();
    const activeLoops = new Set();

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part || !part.trim()) continue;

        if (i % 2 === 1) {
            const tag = part.toLowerCase();

            if (tag.endsWith('_stop')) {
                const baseName = tag.replace('_stop', '');
                segments.push({
                    type: 'loop_stop',
                    value: baseName,
                    order: order++,
                    audioUrl: null,
                    volume: 1.0,
                    delay: 0,
                });
                activeLoops.delete(baseName);
                continue;
            }

            if (tag.endsWith('_start')) {
                const baseName = tag.replace('_start', '');
                const audioUrl = SOUND_LIBRARY[baseName] || null;
                segments.push({
                    type: 'loop_start',
                    value: baseName,
                    order: order++,
                    audioUrl,
                    volume: 1.0,
                    delay: 0,
                });
                activeLoops.add(baseName);
                continue;
            }

            if (SOUND_LIBRARY.hasOwnProperty(tag)) {
                if (seenTags.has(tag)) {
                    segments.push({
                        type: 'loop_stop',
                        value: tag,
                        order: order++,
                        audioUrl: null,
                        volume: 1.0,
                        delay: 0,
                    });
                    seenTags.delete(tag);
                } else {
                    segments.push({
                        type: 'oneshot',
                        value: tag,
                        order: order++,
                        audioUrl: SOUND_LIBRARY[tag] || null,
                        volume: 1.0,
                        delay: 0,
                    });
                    seenTags.add(tag);
                }
            }
            // Unknown tags silently ignored
        } else {
            const cleanText = part
                .replace(/#[a-z][a-z0-9_]*/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
            if (cleanText.length > 0) {
                segments.push({
                    type: 'text',
                    value: cleanText,
                    order: order++,
                    audioUrl: null,
                    volume: 1.0,
                    delay: 0,
                });
            }
        }
    }

    return segments;
}

function stripHashtags(text) {
    return text.replace(/#[a-z][a-z0-9_]*/gi, '').replace(/\s{2,}/g, ' ').trim();
}

/* ── ELEVENLABS TTS ──────────────────────────────────────────────────── */

async function generateSpeech(text, outputPath) {
    const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
        {
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        },
        {
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            responseType: 'arraybuffer',
            timeout: 60000
        }
    );
    await fs.writeFile(outputPath, Buffer.from(response.data));
    return outputPath;
}

/* ── CLOUDINARY UPLOAD ───────────────────────────────────────────────── */

async function uploadToCloudinary(filePath, publicId) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(filePath, {
            resource_type: 'video',
            folder: 'auvies',
            public_id: publicId,
            format: 'mp3'
        }, (err, result) => {
            if (err) reject(err);
            else resolve(result.secure_url);
        });
    });
}

/* ── ROUTES ──────────────────────────────────────────────────────────── */

// GET /api/f3/auvies/sounds — returns available sound cue tag names
router.get('/sounds', (req, res) => {
    const allKeys = Object.keys(SOUND_VARIANTS);
    // Also expose _start/_stop variants for loopable sounds
    const loopable = ['rain', 'thunder'];
    const extra = [];
    for (const tag of loopable) {
        extra.push(`${tag}_start`, `${tag}_stop`);
    }
    res.json([...allKeys, ...extra]);
});

// GET /api/f3/auvies/:id — get auvie details
router.get('/:id', protect, async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id)
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar');
        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        const userId = req.user._id.toString();
        const isAuthor = auvie.author._id.toString() === userId;
        const hasPurchased = auvie.purchasedBy
            .map(id => id.toString())
            .includes(userId);

        const canAccessFull = isAuthor || hasPurchased;

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
            audioUrl: canAccessFull ? auvie.audioUrl : null,
            segments: canAccessFull ? auvie.segments : null,
            createdAt: auvie.createdAt,
        });
    } catch (err) {
        console.error('Fetch auvie error:', err.message);
        res.status(500).json({ error: 'Failed to fetch auvie' });
    }
});

// GET /api/f3/auvies/:id/status — poll generation status
router.get('/:id/status', protect, async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id).select('status errorMessage');
        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });
        res.json({ status: auvie.status, errorMessage: auvie.errorMessage });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// GET /api/f3/auvies/draft/:novelId — preview segments before generating
router.get('/draft/:novelId', protect, async (req, res) => {
    try {
        const novel = await Novel.findOne({ _id: req.params.novelId, author: req.user._id });
        if (!novel) return res.status(404).json({ error: 'Novel not found' });

        let allSegments = [];
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
});

// PUT /api/f3/auvies/:id/segments — author saves volume/delay edits
router.put('/:id/segments', protect, async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id);
        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        if (auvie.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorised to edit this Auvie' });
        }
        if (auvie.status !== 'ready') {
            return res.status(400).json({ error: 'Auvie must be ready before editing segments' });
        }

        const { segments: edits } = req.body;
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
                volume: typeof edit.volume === 'number'
                    ? Math.min(1.0, Math.max(0.0, edit.volume))
                    : seg.volume,
                delay: typeof edit.delay === 'number'
                    ? Math.min(10000, Math.max(0, Math.round(edit.delay)))
                    : seg.delay,
            };
        });

        auvie.segments = updatedSegments;
        await auvie.save();
        res.json({ message: 'Segments updated', segments: auvie.segments });
    } catch (err) {
        console.error('Update segments error:', err.message);
        res.status(500).json({ error: 'Failed to update segments' });
    }
});

// POST /api/f3/auvies/generate/:novelId — writer generates an auvie
router.post('/generate/:novelId', protect, async (req, res) => {
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

        let allSegments = [];
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
        });

        novel.hasAuvie = true;
        novel.auvie = auvie._id;
        await novel.save();

        res.status(202).json({
            message: 'Auvie generation started',
            auvieId: auvie._id,
            status: 'generating',
            segmentCount: allSegments.length,
        });

        // ── BACKGROUND GENERATION ────────────────────────────────────────
        (async () => {
            const workDir = path.join(tmpDir, auvie._id.toString());
            await fs.ensureDir(workDir);

            try {
                const processedSegments = [];
                for (const seg of allSegments) {
                    if (seg.type === 'text') {
                        try {
                            const audioPath = path.join(workDir, `seg_${seg.order}.mp3`);
                            await generateSpeech(seg.value, audioPath);
                            const audioUrl = await uploadToCloudinary(
                                audioPath,
                                `auvie_${auvie._id}_seg_${seg.order}`
                            );
                            await fs.remove(audioPath);
                            processedSegments.push({ ...seg, audioUrl });
                        } catch (segErr) {
                            console.error(`Segment ${seg.order} failed:`, segErr.message);
                            processedSegments.push({ ...seg, audioUrl: null });
                        }
                    } else {
                        processedSegments.push(seg);
                    }
                }

                await Auvie.findByIdAndUpdate(auvie._id, {
                    segments: processedSegments,
                    status: 'ready',
                });
                await fs.remove(workDir);
                console.log(`✅ Auvie ${auvie._id} ready`);

            } catch (genErr) {
                console.error(`❌ Auvie ${auvie._id} failed:`, genErr.message);
                await Auvie.findByIdAndUpdate(auvie._id, {
                    status: 'failed',
                    errorMessage: genErr.message,
                });
                await User.findByIdAndUpdate(req.user._id, {
                    $inc: { coins: AUVIE_GENERATION_COST }
                });
                await CoinTransaction.create({
                    user: req.user._id,
                    type: 'generate_auvie',
                    amount: AUVIE_GENERATION_COST,
                    balanceAfter: user.coins + AUVIE_GENERATION_COST,
                    description: `Refund — auvie generation failed: ${novel.title}`,
                    processor: 'internal',
                    relatedNovel: novel._id,
                });
                if (await fs.pathExists(workDir)) await fs.remove(workDir);
            }
        })();

    } catch (err) {
        console.error('Generate auvie error:', err.message);
        res.status(500).json({ error: 'Failed to start generation' });
    }
});

// POST /api/f3/auvies/:id/purchase — reader purchases an auvie
router.post('/:id/purchase', protect, async (req, res) => {
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
});

module.exports = router;