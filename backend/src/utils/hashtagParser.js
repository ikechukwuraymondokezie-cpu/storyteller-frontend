/* ── HASHTAG PARSER ──────────────────────────────────────────────────────
 * Converts novel chapter content into ordered Auvie segments.
 *
 * Voice tagging:
 * Unknown hashtags (e.g. #hero, #villain) are character switches.
 * Blank tags (#) or #n reset the voice to 'narrator'.
 * ─────────────────────────────────────────────────────────────────────── */

const { buildSoundLibrary } = require('./soundLibrary');

/**
 * Parse chapter content into Auvie segments.
 * @param {string} content - Raw chapter text with #sound_tags
 * @returns {Array} Ordered segment objects
 */
function parseHashtags(content) {
    const SOUND_LIBRARY = buildSoundLibrary();

    /**
     * Regex breakdown:
     * #([a-zA-Z][a-zA-Z0-9_]*) -> standard tags (now allowing caps for names like #John)
     * |#(?=\s|$)               -> looks for '#' followed by space or end of string (Blank Reset)
     */
    const tagPattern = /#([a-zA-Z][a-zA-Z0-9_]*)|#(?=\s|$)/g;

    const parts = content.split(tagPattern);
    const segments = [];
    let order = 0;
    let currentVoiceTag = 'narrator';

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (part === undefined) continue;
        if (!part && i % 2 === 0) continue;

        if (i % 2 === 1) {
            // Captured hashtag name - Keep original casing for display, but lowercase for SFX check
            const originalTag = part.trim();
            const lowerTag = originalTag.toLowerCase();

            // 1. BLANK RESET (#) or MANUAL NARRATOR (#n)
            if (lowerTag === "" || lowerTag === "n") {
                currentVoiceTag = 'narrator';
                continue;
            }

            // 2. LOOP STOP
            if (lowerTag.endsWith('_stop')) {
                const baseName = lowerTag.slice(0, -5);
                segments.push({
                    type: 'loop_stop',
                    value: baseName, // Use the actual name (e.g., 'rain')
                    voiceTag: currentVoiceTag,
                    order: order++,
                    audioUrl: null,
                    volume: 1.0,
                    delay: 0,
                });

                // 3. LOOP START
            } else if (lowerTag.endsWith('_start')) {
                const baseName = lowerTag.slice(0, -6);
                segments.push({
                    type: 'loop_start',
                    value: baseName,
                    voiceTag: currentVoiceTag,
                    order: order++,
                    audioUrl: SOUND_LIBRARY[baseName] || SOUND_LIBRARY[`${baseName}_start`] || null,
                    volume: 1.0,
                    delay: 0,
                });

                // 4. KNOWN SFX (oneshot)
            } else if (Object.prototype.hasOwnProperty.call(SOUND_LIBRARY, lowerTag)) {
                segments.push({
                    type: 'oneshot',
                    value: lowerTag, // Shows 'gunshot' instead of 'sfx'
                    voiceTag: currentVoiceTag,
                    order: order++,
                    audioUrl: SOUND_LIBRARY[lowerTag],
                    volume: 1.0,
                    delay: 0,
                });

                // 5. UNKNOWN TAG -> Character Switch (e.g., #John)
            } else {
                currentVoiceTag = originalTag;
            }

        } else {
            // Text between tags
            const cleanText = part.trim();

            if (cleanText.length > 0) {
                segments.push({
                    type: 'text',
                    value: cleanText,
                    voiceTag: currentVoiceTag.toLowerCase(), // For logic/ElevenLabs
                    characterName: currentVoiceTag,         // For Workshop UI Display (e.g., 'John')
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
 * Strip all #hashtags from text for reader-facing display.
 */
function stripHashtags(text) {
    return text
        .replace(/#([a-zA-Z][a-zA-Z0-9_]*)|#(?=\s|$)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

module.exports = { parseHashtags, stripHashtags };