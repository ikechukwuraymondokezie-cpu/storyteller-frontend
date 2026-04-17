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
     * #([a-z][a-z0-9_]*) -> standard tags with names
     * |#(?=\s|$)         -> looks for '#' followed by space or end of string (Blank Reset)
     */
    const tagPattern = /#([a-z][a-z0-9_]*)|#(?=\s|$)/gi;

    // We use a manual split/match loop here to ensure the "Blank Tag" is captured correctly
    const parts = content.split(tagPattern);
    const segments = [];
    let order = 0;
    let currentVoiceTag = 'narrator';

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // Handle undefined parts from the regex capture groups
        if (part === undefined) continue;
        if (!part && i % 2 === 0) continue;

        if (i % 2 === 1) {
            // Captured hashtag name
            const tag = part.toLowerCase().trim();

            // 1. BLANK RESET (#) or MANUAL NARRATOR (#n)
            if (tag === "" || tag === "n") {
                currentVoiceTag = 'narrator';
                continue;
            }

            // 2. LOOP STOP
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

                // 3. LOOP START
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

                // 4. KNOWN SFX (oneshot)
            } else if (Object.prototype.hasOwnProperty.call(SOUND_LIBRARY, tag)) {
                segments.push({
                    type: 'oneshot',
                    value: tag,
                    voiceTag: currentVoiceTag,
                    order: order++,
                    audioUrl: SOUND_LIBRARY[tag],
                    volume: 1.0,
                    delay: 0,
                });

                // 5. UNKNOWN TAG -> Character Switch
            } else {
                currentVoiceTag = tag;
            }

        } else {
            // Text between tags
            const cleanText = part.trim();

            if (cleanText.length > 0) {
                segments.push({
                    type: 'text',
                    value: cleanText,
                    voiceTag: currentVoiceTag, // Uses whatever character is currently active
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
 * Includes lone hashtags.
 */
function stripHashtags(text) {
    return text
        .replace(/#([a-z][a-z0-9_]*)|#(?=\s|$)/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

module.exports = { parseHashtags, stripHashtags };