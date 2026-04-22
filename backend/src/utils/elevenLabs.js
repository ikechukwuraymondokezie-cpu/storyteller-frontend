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
                model_id: 'eleven_multilingual_v2', // V2 Model handles the context and accent better
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
 * Fetches all voices with V2 attributes and Preview URLs for the Flutter Workshop
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

        // Ensure we pass the preview_url so you can listen to them in the app
        return response.data.voices.map(v => ({
            voice_id: v.voice_id,
            name: v.name,
            preview_url: v.preview_url, // Direct link to listen to the voice
            category: v.category,
            labels: v.labels,
            description: v.description
        }));
    } catch (err) {
        console.error('ElevenLabs Fetch Voices Error:', err.response?.data || err.message);
        throw new Error('Failed to fetch voices from ElevenLabs');
    }
};

/**
 * ADMIN UTILITY: Use this to give your account coins for testing
 * You can call this from a temporary route or directly in your code
 */
exports.grantTestCoins = async (User, userId, amount = 50000) => {
    try {
        const user = await User.findById(userId);
        if (user) {
            user.coins += amount;
            await user.save();
            console.log(`✅ Success: Added ${amount} coins to user ${user.username}`);
            return user.coins;
        }
    } catch (err) {
        console.error('Failed to grant test coins:', err.message);
    }
};