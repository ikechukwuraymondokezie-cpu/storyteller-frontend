const express = require('express');
const router = express.Router();
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const fs = require('fs-extra');
const path = require('path');
const Novel = require('../models/Novel');
const Auvie = require('../models/Auvie');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { protect } = require('../middleware/authMiddleware');

/* ── CONSTANTS ───────────────────────────────────────────────────────── */

// Platform-set coin price for purchasing an auvie
const AUVIE_PURCHASE_PRICE = 200;

// Coin cost for writer to generate an auvie (covers ElevenLabs cost)
const AUVIE_GENERATION_COST = 100;

// Platform commission on auvie sales: 25%
const PLATFORM_COMMISSION = 0.25;

// Sound effects library — maps cue names to public audio URLs
// These are stored on Cloudinary or your CDN
const SOUND_EFFECTS = {
    DOOR_CREAK: process.env.SFX_DOOR_CREAK || null,
    EXPLOSION: process.env.SFX_EXPLOSION || null,
    RAIN: process.env.SFX_RAIN || null,
    THUNDER: process.env.SFX_THUNDER || null,
    FOOTSTEPS: process.env.SFX_FOOTSTEPS || null,
    CROWD_NOISE: process.env.SFX_CROWD || null,
    GUNSHOT: process.env.SFX_GUNSHOT || null,
    HEARTBEAT: process.env.SFX_HEARTBEAT || null,
    WIND: process.env.SFX_WIND || null,
    FIRE: process.env.SFX_FIRE || null,
    CAR_ENGINE: process.env.SFX_CAR_ENGINE || null,
    PHONE_RING: process.env.SFX_PHONE_RING || null,
    APPLAUSE: process.env.SFX_APPLAUSE || null,
    MUSIC_DRAMATIC: process.env.SFX_MUSIC_DRAMATIC || null,
    MUSIC_SUSPENSE: process.env.SFX_MUSIC_SUSPENSE || null,
};

/* ── HELPERS ─────────────────────────────────────────────────────────── */

/**
 * Parses novel chapter content into segments — alternating text and cues.
 * Cues are written as [CUE_NAME] in the chapter content.
 * Example: "He opened the door [DOOR_CREAK] and stepped inside."
 * Returns: [{type:'text', value:'He opened the door', order:0},
 *           {type:'cue', value:'DOOR_CREAK', order:1},
 *           {type:'text', value:'and stepped inside.', order:2}]
 */
function parseSegments(content) {
    const cuePattern = /\[([A-Z_]+)\]/g;
    const parts = content.split(cuePattern);
    const segments = [];
    let order = 0;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) continue;

        // Odd indices after split are the captured cue names
        const isCue = i % 2 === 1;

        if (isCue) {
            // Only include known cues
            if (SOUND_EFFECTS.hasOwnProperty(part)) {
                segments.push({ type: 'cue', value: part, order: order++ });
            }
        } else {
            segments.push({ type: 'text', value: part, order: order++ });
        }
    }

    return segments;
}

/**
 * Calls ElevenLabs API to convert a text segment to audio.
 * Returns a buffer of the MP3 audio.
 */
async function generateSpeech(text) {
    const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
        {
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75
            }
        },
        {
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            responseType: 'arraybuffer',
            timeout: 30000
        }
    );
    return Buffer.from(response.data);
}

/**
 * Uploads a buffer to Cloudinary as a raw audio file.
 * Returns the secure URL.
 */
async function uploadAudioBuffer(buffer, publicId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: 'video', // Cloudinary uses 'video' for audio files
                folder: 'auvie_segments',
                public_id: publicId,
                format: 'mp3'
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        uploadStream.end(buffer);
    });
}

/* ── GET SOUND EFFECTS LIST ──────────────────────────────────────────── */

// GET /api/f3/auvies/cues — returns available sound cue names for writers
router.get('/cues', (req, res) => {
    res.json(Object.keys(SOUND_EFFECTS));
});

/* ── GET AUVIE ───────────────────────────────────────────────────────── */

// GET /api/f3/auvies/:id — get auvie details
router.get('/:id', protect, async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id)
            .populate('novel', 'title cover')
            .populate('author', 'name username avatar');

        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });

        const hasPurchased = auvie.purchasedBy
            .map(id => id.toString())
            .includes(req.user._id.toString());

        res.json({
            _id: auvie._id,
            novel: auvie.novel,
            author: auvie.author,
            status: auvie.status,
            duration: auvie.duration,
            coinPrice: auvie.coinPrice,
            plays: auvie.plays,
            hasPurchased,
            // Only include audio URL if purchased
            audioUrl: hasPurchased ? auvie.audioUrl : null,
            segments: hasPurchased ? auvie.segments : null,
            createdAt: auvie.createdAt,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch auvie' });
    }
});

/* ── GENERATE AUVIE ──────────────────────────────────────────────────── */

/**
 * POST /api/f3/auvies/generate/:novelId
 * Writer spends coins to generate an auvie from their novel.
 * Processes each chapter — splits on cues, calls ElevenLabs per text segment,
 * uploads each audio segment to Cloudinary.
 * The Flutter app then plays segments in sequence, firing sound effects at cues.
 */
router.post('/generate/:novelId', protect, async (req, res) => {
    try {
        const novel = await Novel.findOne({
            _id: req.params.novelId,
            author: req.user._id
        });

        if (!novel) return res.status(404).json({ error: 'Novel not found' });
        if (novel.status !== 'published') {
            return res.status(400).json({ error: 'Publish the novel before generating an auvie' });
        }
        if (novel.hasAuvie) {
            return res.status(400).json({ error: 'This novel already has an auvie' });
        }

        // Check writer has enough coins
        const user = await User.findById(req.user._id);
        if (user.coins < AUVIE_GENERATION_COST) {
            return res.status(400).json({
                error: 'Insufficient coins',
                required: AUVIE_GENERATION_COST,
                current: user.coins
            });
        }

        // Deduct generation coins immediately
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

        // Create auvie record with pending status
        const auvie = await Auvie.create({
            novel: novel._id,
            author: req.user._id,
            status: 'generating',
            coinPrice: AUVIE_PURCHASE_PRICE,
            generationCost: AUVIE_GENERATION_COST,
        });

        // Link auvie to novel
        novel.hasAuvie = true;
        novel.auvie = auvie._id;
        await novel.save();

        // Respond immediately — generation happens in background
        res.status(202).json({
            message: 'Auvie generation started',
            auvieId: auvie._id,
            status: 'generating'
        });

        // ── BACKGROUND GENERATION ────────────────────────────────────
        (async () => {
            try {
                const allSegments = [];

                // Parse all chapters into segments
                for (const chapter of novel.chapters) {
                    const chapterSegments = parseSegments(chapter.content);
                    allSegments.push(...chapterSegments);
                }

                // Generate audio for each text segment
                const processedSegments = [];
                for (const segment of allSegments) {
                    if (segment.type === 'text') {
                        try {
                            const audioBuffer = await generateSpeech(segment.value);
                            const publicId = `auvie_${auvie._id}_seg_${segment.order}`;
                            const audioUrl = await uploadAudioBuffer(audioBuffer, publicId);
                            processedSegments.push({ ...segment, audioUrl });
                        } catch (segErr) {
                            console.error(`Segment ${segment.order} generation failed:`, segErr.message);
                            processedSegments.push({ ...segment, audioUrl: null });
                        }
                    } else {
                        // Cue segment — include the sound effect URL
                        processedSegments.push({
                            ...segment,
                            audioUrl: SOUND_EFFECTS[segment.value] || null
                        });
                    }
                }

                // Update auvie with segments and mark ready
                await Auvie.findByIdAndUpdate(auvie._id, {
                    segments: processedSegments,
                    status: 'ready',
                });

                console.log(`✅ Auvie ${auvie._id} generation complete`);

            } catch (genErr) {
                console.error(`❌ Auvie ${auvie._id} generation failed:`, genErr.message);
                await Auvie.findByIdAndUpdate(auvie._id, {
                    status: 'failed',
                    errorMessage: genErr.message
                });
                // Refund writer coins on failure
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
            }
        })();

    } catch (err) {
        res.status(500).json({ error: 'Failed to start auvie generation' });
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

/* ── PURCHASE AUVIE ──────────────────────────────────────────────────── */

// POST /api/f3/auvies/:id/purchase — reader spends coins to unlock auvie
router.post('/:id/purchase', protect, async (req, res) => {
    try {
        const auvie = await Auvie.findById(req.params.id)
            .populate('novel', 'title');

        if (!auvie) return res.status(404).json({ error: 'Auvie not found' });
        if (auvie.status !== 'ready') {
            return res.status(400).json({ error: 'Auvie is not ready yet' });
        }

        // Check if already purchased
        if (auvie.purchasedBy.map(id => id.toString()).includes(req.user._id.toString())) {
            return res.status(400).json({ error: 'Already purchased' });
        }

        const user = await User.findById(req.user._id);

        if (user.coins < auvie.coinPrice) {
            return res.status(400).json({
                error: 'Insufficient coins',
                required: auvie.coinPrice,
                current: user.coins
            });
        }

        const commission = Math.floor(auvie.coinPrice * PLATFORM_COMMISSION);
        const authorEarning = auvie.coinPrice - commission;

        // Deduct from reader
        user.coins -= auvie.coinPrice;
        user.purchasedAuvies.push(auvie._id);
        await user.save();

        // Credit author
        await User.findByIdAndUpdate(auvie.author, {
            $inc: { coins: authorEarning }
        });

        // Add reader to purchasedBy
        auvie.purchasedBy.push(req.user._id);
        auvie.plays += 1;
        await auvie.save();

        // Log transactions
        await CoinTransaction.create({
            user: req.user._id,
            type: 'spend_auvie',
            amount: -auvie.coinPrice,
            balanceAfter: user.coins,
            description: `Purchased auvie: ${auvie.novel.title}`,
            processor: 'internal',
            relatedAuvie: auvie._id,
            relatedNovel: auvie.novel._id,
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
            message: 'Auvie purchased successfully',
            coinsRemaining: user.coins,
            segments: auvie.segments,
        });

    } catch (err) {
        res.status(500).json({ error: 'Failed to purchase auvie' });
    }
});

module.exports = router;