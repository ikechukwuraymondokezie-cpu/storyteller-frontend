const axios = require('axios');
const fs = require('fs-extra');

// ── FREE TIER SAFE DEFAULTS ───────────────────────────────────────────
// eleven_multilingual_v2 = PAID ONLY → causes 401 on free tier
// eleven_monolingual_v1  = FREE TIER safe
// Switch to 'eleven_multilingual_v2' only after upgrading your plan
const FREE_TIER_MODEL = 'eleven_monolingual_v1';
const PAID_TIER_MODEL = 'eleven_multilingual_v2';
const MODEL_ID = process.env.DEV_MODE === 'true' ? FREE_TIER_MODEL : PAID_TIER_MODEL;

// ── FREE TIER SAFE VOICE IDs ──────────────────────────────────────────
// The voice IDs your Workshop was sending (Xq2dbIWNPChFB77imiDe etc.)
// are premium/cloned voices — free tier blocks them with 401.
// These are ElevenLabs' built-in default voices, always free to use.
const FREE_VOICES = {
    rachel: '21m00Tcm4TlvDq8ikWAM',
    domi: 'AZnzlk1XvdvUeBnXmlld',
    bella: 'EXAVITQu4vr4xnSDxMaL',
    antoni: 'ErXwobaYiN019PkySvjV',
    elli: 'MF3mGyEYCl7XYWbV9V9O',
    josh: 'TxGEqnHWrfWFTfGW9XjX',
    arnold: 'VR6AewLTigWG4xSOukaG',
    adam: 'pNInz6obpg8ndPey74S',   // your existing fallback — keep this
    sam: 'yoZ06aMxZJJ28mfd3POQ',
};

// If a premium voice ID is requested in DEV_MODE, swap it for Adam (free).
// This means your Workshop voice assignments still work — they just get
// remapped to a free voice during testing. No code changes needed on upgrade.
function _resolveVoiceId(requestedVoiceId) {
    if (process.env.DEV_MODE !== 'true') {
        // Production / paid plan — use whatever voice was requested
        return requestedVoiceId || process.env.ELEVENLABS_VOICE_ID || FREE_VOICES.adam;
    }

    // DEV_MODE: check if the requested voice is one of the known free ones
    const freeVoiceIds = Object.values(FREE_VOICES);
    if (requestedVoiceId && freeVoiceIds.includes(requestedVoiceId)) {
        return requestedVoiceId; // it's already a free voice, use it
    }

    // Not a free voice — fall back to Adam so the generation succeeds
    const fallback = process.env.ELEVENLABS_VOICE_ID || FREE_VOICES.adam;
    console.log(`[ElevenLabs] DEV_MODE: voice ${requestedVoiceId} is premium — using fallback: ${fallback}`);
    return fallback;
}

// ── RETRY HELPER ──────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function _withRetry(fn, retries = 2, baseDelayMs = 3000) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            const status = err.response?.status;

            // 401 — decode the arraybuffer body to check the reason
            if (status === 401) {
                const body = err.response?.data;
                let detail;
                try {
                    detail = Buffer.isBuffer(body)
                        ? JSON.parse(body.toString())?.detail?.status
                        : body?.detail?.status;
                } catch (_) { }

                if (detail === 'detected_unusual_activity') {
                    console.error('[ElevenLabs] Key flagged for unusual activity. Generate a new API key on elevenlabs.io');
                    throw new Error('ElevenLabs key flagged: detected_unusual_activity. Replace ELEVENLABS_API_KEY on Render.');
                }

                // Other 401 = bad key / wrong voice — no point retrying
                console.error(`[ElevenLabs] 401 Unauthorized — check ELEVENLABS_API_KEY and voice ID`);
                throw err;
            }

            // 429 = rate limit — retry with backoff
            if (status === 429 && attempt < retries) {
                const wait = baseDelayMs * (attempt + 1);
                console.log(`[ElevenLabs] Rate limited (429). Waiting ${wait}ms before retry ${attempt + 1}/${retries}...`);
                await sleep(wait);
                continue;
            }

            // 5xx server error — retry with backoff
            if (status >= 500 && attempt < retries) {
                const wait = baseDelayMs * (attempt + 1);
                console.log(`[ElevenLabs] Server error (${status}). Waiting ${wait}ms before retry ${attempt + 1}/${retries}...`);
                await sleep(wait);
                continue;
            }

            // Any other error — throw immediately
            throw err;
        }
    }
    throw lastErr;
}

/**
 * Generates speech via ElevenLabs API.
 * DEV_MODE=true  → uses eleven_monolingual_v1 (free) + remaps premium voices to Adam
 * DEV_MODE=false → uses eleven_multilingual_v2 (paid) + uses requested voice as-is
 */
exports.generateSpeech = async (text, outputPath, voiceId) => {
    const resolvedVoiceId = _resolveVoiceId(voiceId);

    if (!resolvedVoiceId) {
        throw new Error('ElevenLabs: No voiceId resolved. Set ELEVENLABS_VOICE_ID in Render env vars.');
    }

    console.log(`[ElevenLabs] Generating — model: ${MODEL_ID}, voice: ${resolvedVoiceId}, chars: ${text.length}`);

    return _withRetry(async () => {
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`,
            data: {
                text: text,
                model_id: MODEL_ID,
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                }
            },
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
            },
            responseType: 'arraybuffer',
            timeout: 60000,
        });

        await fs.writeFile(outputPath, Buffer.from(response.data));
        console.log(`[ElevenLabs] Success — written to ${outputPath}`);
        return outputPath;
    });
};

/**
 * Fetches available voices.
 * In DEV_MODE only returns the free built-in voices so the Workshop
 * dropdown doesn't show premium voices that would cause 401s.
 */
exports.fetchElevenLabsVoices = async () => {
    try {
        const response = await axios({
            method: 'get',
            url: 'https://api.elevenlabs.io/v1/voices',
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
            },
        });

        const allVoices = response.data.voices.map(v => ({
            voice_id: v.voice_id,
            name: v.name,
            preview_url: v.preview_url,
            category: v.category,
            labels: v.labels,
            description: v.description,
        }));

        if (process.env.DEV_MODE === 'true') {
            // In dev, only expose the free built-in voices
            // so authors don't accidentally pick a premium voice
            const freeIds = Object.values(FREE_VOICES);
            const freeOnly = allVoices.filter(v => freeIds.includes(v.voice_id));
            console.log(`[ElevenLabs] DEV_MODE: returning ${freeOnly.length} free voices only`);
            return freeOnly.length > 0 ? freeOnly : allVoices;
        }

        return allVoices;
    } catch (err) {
        console.error('[ElevenLabs] fetchVoices error:', err.response?.data || err.message);
        throw new Error('Failed to fetch voices from ElevenLabs');
    }
};

/**
 * ADMIN UTILITY: Grant test coins to a user account
 */
exports.grantTestCoins = async (User, userId, amount = 50000) => {
    try {
        const user = await User.findById(userId);
        if (user) {
            user.coins += amount;
            await user.save();
            console.log(`✅ Granted ${amount} coins to ${user.username}. New balance: ${user.coins}`);
            return user.coins;
        }
    } catch (err) {
        console.error('grantTestCoins error:', err.message);
    }
};