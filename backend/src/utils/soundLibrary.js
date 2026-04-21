/* ── SOUND LIBRARY ───────────────────────────────────────────────────────
 * All Cloudinary sound URLs live here.
 * The routes and controller never need to know about URLs directly.
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
 * Pick a random variant from an array of URLs.
 */
function pickVariant(variants) {
    if (!variants || variants.length === 0) return null;
    return variants[Math.floor(Math.random() * variants.length)];
}

/**
 * Build a flat key → URL map with random variant selection.
 * Also auto-generates _start/_stop keys for every sound.
 */
function buildSoundLibrary() {
    const lib = {};
    for (const [key, variants] of Object.entries(SOUND_VARIANTS)) {
        const picked = pickVariant(variants);
        lib[key] = picked;
        lib[`${key}_start`] = picked;
        lib[`${key}_stop`] = null; // stop tag carries no audio
    }
    return lib;
}

/**
 * Returns all sound tag names Flutter should know about
 * (base names + _start/_stop variants).
 */
function getAllSoundTags() {
    const keys = Object.keys(SOUND_VARIANTS);
    const loops = keys.flatMap(k => [`${k}_start`, `${k}_stop`]);
    return [...keys, ...loops];
}

module.exports = { SOUND_VARIANTS, buildSoundLibrary, getAllSoundTags };