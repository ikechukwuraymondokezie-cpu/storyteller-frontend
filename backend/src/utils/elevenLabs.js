const axios = require('axios');
const fs = require('fs-extra');

// ── MODEL SETTINGS ───────────────────────────────────────────────────
// We are now defaulting to v2 for everything. 
// If a specific generation fails, check if that specific voice supports v2.
const MODEL_ID = 'eleven_multilingual_v2';

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

            if (status === 401) {
                const body = err.response?.data;
                let detail;
                try {
                    // Check for the "unusual activity" ban
                    detail = Buffer.isBuffer(body)
                        ? JSON.parse(body.toString())?.detail?.status
                        : body?.detail?.status;
                } catch (_) { }

                if (detail === 'detected_unusual_activity') {
                    console.error('[ElevenLabs] Key flagged for unusual activity.');
                    throw new Error('ElevenLabs key flagged. Rotate your API key.');
                }
                throw err;
            }

            // 429 = Rate limit / 5xx = Server error
            if ((status === 429 || status >= 500) && attempt < retries) {
                const wait = baseDelayMs * (attempt + 1);
                console.log(`[ElevenLabs] Error ${status}. Retrying in ${wait}ms...`);
                await sleep(wait);
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

/**
 * Generates speech via ElevenLabs API.
 * Now uses V2 by default and uses whatever voiceId you provide.
 */
exports.generateSpeech = async (text, outputPath, voiceId) => {
    // We use the voiceId exactly as it comes from the Workshop
    const finalVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID;

    if (!finalVoiceId) {
        throw new Error('ElevenLabs: No voiceId provided.');
    }

    console.log(`[ElevenLabs] Generating — model: ${MODEL_ID}, voice: ${finalVoiceId}, chars: ${text.length}`);

    return _withRetry(async () => {
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`,
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
 * Fetches ALL available voices.
 * No more filtering in DEV_MODE.
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

        return response.data.voices.map(v => ({
            voice_id: v.voice_id,
            name: v.name,
            preview_url: v.preview_url,
            category: v.category,
            labels: v.labels,
            description: v.description,
        }));
    } catch (err) {
        console.error('[ElevenLabs] fetchVoices error:', err.response?.data || err.message);
        throw new Error('Failed to fetch voices from ElevenLabs');
    }
};

exports.grantTestCoins = async (User, userId, amount = 50000) => {
    try {
        const user = await User.findById(userId);
        if (user) {
            user.coins += amount;
            await user.save();
            return user.coins;
        }
    } catch (err) {
        console.error('grantTestCoins error:', err.message);
    }
};