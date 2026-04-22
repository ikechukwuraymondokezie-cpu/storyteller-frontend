const axios = require('axios');
const fs = require('fs-extra');

/**
 * Generates speech via ElevenLabs API
 * Optimized for Nigerian English/Accents using the Multilingual V2 model
 */
exports.generateSpeech = async (text, outputPath, voiceId) => {
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
                model_id: 'eleven_multilingual_v2',
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
            timeout: 60000
        });

        await fs.writeFile(outputPath, Buffer.from(response.data));
        return outputPath;
    } catch (err) {
        console.error(`ElevenLabs API Error for voice ${vId}:`, err.response?.data || err.message);
        throw err;
    }
};

/**
 * UPDATED: Renamed to match auvieController.js import
 * Proxy function to fetch available voices for the Flutter UI
 */
exports.fetchElevenLabsVoices = async () => {
    try {
        const response = await axios({
            method: 'get',
            url: 'https://api.elevenlabs.io/v1/voices',
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY
            }
        });
        return response.data.voices;
    } catch (err) {
        console.error('ElevenLabs Fetch Voices Error:', err.response?.data || err.message);
        throw new Error('Failed to fetch voices from ElevenLabs');
    }
};