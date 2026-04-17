const axios = require('axios');
const fs = require('fs-extra');

/**
 * Generates speech via ElevenLabs API
 * Optimized for Nigerian English/Accents using the Multilingual V2 model
 */
exports.generateSpeech = async (text, outputPath, voiceId) => {
    // 1. Resolve Voice ID (Fallback to ENV if specific ID isn't passed)
    const vId = voiceId || process.env.ELEVENLABS_VOICE_ID;

    if (!vId) {
        throw new Error('ElevenLabs Error: No voiceId provided and no ELEVENLABS_VOICE_ID found in .env');
    }

    try {
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${vId}`,
            data: {
                text: text,
                model_id: 'eleven_multilingual_v2', // The goat for Nigerian/diverse accents
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            },
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            responseType: 'arraybuffer',
            // High timeout because long segments take time to process
            timeout: 60000
        });

        // 2. Write the buffer to the temp directory
        await fs.writeFile(outputPath, Buffer.from(response.data));

        return outputPath;
    } catch (err) {
        // Log details for easier debugging on Render/Heroku
        console.error(`ElevenLabs API Error for voice ${vId}:`, err.response?.data || err.message);
        throw err;
    }
};

/**
 * Proxy function to fetch available voices for the Flutter UI
 */
exports.fetchVoices = async () => {
    const response = await axios({
        method: 'get',
        url: 'https://api.elevenlabs.io/v1/voices',
        headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY
        }
    });
    return response.data.voices;
};