/* ── SOUND LIBRARY ───────────────────────────────────────────────────────
 * Updated: Direct Address System. 
 * Allows authors to specify exact variants like #gunshot1 or #rain3.
 * ─────────────────────────────────────────────────────────────────────── */

const SOUND_VARIANTS = {
    gunshot: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827783/sfx/action/gunshot001.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827781/sfx/action/canonshot001.wav',
    ],
    explosion: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827786/sfx/action/stoneimpact001.wav',
    ],
    sword_clash: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827784/sfx/action/industriallever001.wav',
    ],
    mechanism: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827785/sfx/action/mechanism001.wav',
    ],
    rain: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827807/sfx/atmosphere/rain001.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827818/sfx/atmosphere/rain002.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827823/sfx/atmosphere/rain003.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827829/sfx/atmosphere/rain004.wav',
    ],
    thunder: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827835/sfx/atmosphere/thunder001.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827841/sfx/atmosphere/thunder002.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827848/sfx/atmosphere/thunder003.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827855/sfx/atmosphere/thunder004.wav',
    ],
    water_splash: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827857/sfx/atmosphere/waterimpact001.wav',
    ],
    wave: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827873/sfx/atmosphere/wave001.wav',
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827881/sfx/atmosphere/wave002.wav',
    ],
    stream: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827805/sfx/atmosphere/gentlestream001.wav',
    ],
    boiling_water: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827792/sfx/atmosphere/boilingwater001.wav',
    ],
    electricity: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827800/sfx/atmosphere/electricity001.wav',
    ],
    steampunk: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827831/sfx/atmosphere/steampunkmechanism001.wav',
    ],
    impact: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827883/sfx/Transition/impact%20001.wav',
    ],
    whoosh: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827885/sfx/Transition/somethingmoved001.wav',
    ],
    clock: [
        'https://res.cloudinary.com/dnedkkyis/video/upload/v1775827892/sfx/Transition/clocktick001.wav',
    ],
};

/**
 * Builds a comprehensive map of tag -> URL.
 * Every variant is registered as 'tag' + 'index+1' (e.g., rain1, rain2).
 * For backward compatibility, the base tag (e.g., 'rain') uses variant 1.
 */
function buildSoundLibrary() {
    const lib = {};

    for (const [key, variants] of Object.entries(SOUND_VARIANTS)) {
        variants.forEach((url, index) => {
            const variantNumber = index + 1;
            const uniqueTag = `${key}${variantNumber}`;

            lib[uniqueTag] = url;

            // Map the primary/start tags to the first variant by default
            if (index === 0) {
                lib[key] = url;
                lib[`${key}_start`] = url;
            }
        });

        // Loop stops never carry audio
        lib[`${key}_stop`] = null;
    }

    return lib;
}

/**
 * Returns a flat list of all valid tags for the Flutter dropdown.
 * Includes indexed variants (rain1, rain2) and control tags (rain_stop).
 */
function getAllSoundTags() {
    const allTags = [];

    for (const [key, variants] of Object.entries(SOUND_VARIANTS)) {
        // Add indexed variants: gunshot1, gunshot2...
        variants.forEach((_, index) => {
            allTags.push(`${key}${index + 1}`);
        });

        // Add control tags
        allTags.push(`${key}_start`);
        allTags.push(`${key}_stop`);

        // Add the base tag as a generic option
        allTags.push(key);
    }

    return [...new Set(allTags)].sort(); // Deduplicate and sort
}

module.exports = { SOUND_VARIANTS, buildSoundLibrary, getAllSoundTags };