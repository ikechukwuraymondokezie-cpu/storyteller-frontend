/* ── HASHTAG PARSER ──────────────────────────────────────────────────────
 * Converts novel chapter content into ordered Auvie segments.
 *
 * Segment types:
 *   text       → sent to ElevenLabs TTS
 *   oneshot    → sound plays once, then stops
 *   loop_start → sound loops from this point
 *   loop_stop  → stops the loop
 *
 * Voice tagging:
 *   Unknown hashtags (e.g. #hero, #villain) are treated as voice character
 *   switches and attached as voiceTag to subsequent text segments.
 * ─────────────────────────────────────────────────────────────────────── */

const { buildSoundLibrary } = require('./soundLibrary');

/**
 * Parse chapter content into Auvie segments.
 * @param {string} content - Raw chapter text with #sound_tags
 * @returns {Array} Ordered segment objects
 */
function parseHashtags(content) {
    const SOUND_LIBRARY = buildSoundLibrary();

    const tagPattern = /#([a-z][a-z0-9_]*)/gi;
    const parts = content.split(tagPattern);
    const segments = [];
    let order = 0;
    let currentVoiceTag = 'narrator'; // default voice character

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        if (i % 2 === 1) {
            // Captured hashtag name (without the #)
            const tag = part.toLowerCase();

            if (tag.endsWith('_stop')) {
                const baseName = tag.slice(0, -5);
                segments.push({
                    type: 'loop_stop',
                    value: baseName,
                    voiceTag: currentVoiceTag,
                    order: order++,
                    audioUrl: null,
                    volume: 1.0,
                    delay: 0,
                });

            } else if (tag.endsWith('_start')) {
                const baseName = tag.slice(0, -6);
                segments.push({
                    type: 'loop_start',
                    value: baseName,
                    voiceTag: currentVoiceTag,
                    order: order++,
                    audioUrl: SOUND_LIBRARY[baseName] || SOUND_LIBRARY[`${baseName}_start`] || null,
                    volume: 1.0,
                    delay: 0,
                });

            } else if (Object.prototype.hasOwnProperty.call(SOUND_LIBRARY, tag)) {
                // Known sound → oneshot
                segments.push({
                    type: 'oneshot',
                    value: tag,
                    voiceTag: currentVoiceTag,
                    order: order++,
                    audioUrl: SOUND_LIBRARY[tag],
                    volume: 1.0,
                    delay: 0,
                });

            } else {
                // Unknown tag → voice character switch
                currentVoiceTag = tag;
            }

        } else {
            // Text between tags — strip any stray # fragments
            const cleanText = part
                .replace(/#[a-z][a-z0-9_]*/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            if (cleanText.length > 0) {
                segments.push({
                    type: 'text',
                    value: cleanText,
                    voiceTag: currentVoiceTag,
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

/**
 * Strip all #hashtags from text for reader-facing display or TTS.
 */
function stripHashtags(text) {
    return text
        .replace(/#[a-z][a-z0-9_]*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

module.exports = { parseHashtags, stripHashtags };