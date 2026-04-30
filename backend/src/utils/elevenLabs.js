const axios = require('axios');
const fs = require('fs-extra');
const cloudinary = require('cloudinary').v2;

// ── CLOUDINARY CONFIGURATION ─────────────────────────────────────────
// This uses your CLOUDINARY_URL environment variable automatically
cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
});

// ── MODEL SETTINGS ───────────────────────────────────────────────────
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
 * Uploads generated audio to Cloudinary.
 * Required for the Auvie background worker.
 */
exports.uploadAudioToCloudinary = async (filePath, publicId) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            resource_type: 'video', // Required for audio files
            public_id: publicId,
            overwrite: true,
        });
        console.log(`[Cloudinary] Upload Success: ${result.secure_url}`);
        return result.secure_url;
    } catch (error) {
        console.error('[Cloudinary] Upload Error:', error.message);
        throw error;
    }
};

/**
 * Generates speech via ElevenLabs API.
 */
exports.generateSpeech = async (text, outputPath, voiceId) => {
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