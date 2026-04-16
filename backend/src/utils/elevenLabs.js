const axios = require('axios');
const fs = require('fs-extra');

exports.generateSpeech = async (text, outputPath, voiceId) => {
    const response = await axios({
        method: 'post',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        data: {
            text: text,
            model_id: 'eleven_multilingual_v2', // Best for Nigerian English/Accents
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        },
        headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer'
    });

    await fs.writeFile(outputPath, Buffer.from(response.data));
};