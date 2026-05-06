/* ── AUVIE ROUTES ────────────────────────────────────────────────────────
 * HTTP wiring only — no business logic lives here.
 * All logic is in auvieController.js.
 * ─────────────────────────────────────────────────────────────────────── */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/auvieController');

// ── 1. PUBLIC ROUTES ──────────────────────────────────────────────────
// These must be accessible without a token so the Novel Detail screen 
// can check for audio versions immediately.

router.get('/sounds', ctrl.getSounds);

// New: Fetch Auvie data by Chapter ID (Public)
router.get('/chapter/:chapterId', ctrl.getAuvieByChapter);

// New: Fetch Auvie data by Novel ID (Public fallback)
router.get('/novel/:novelId', ctrl.getAuvieByNovel);


// ── 2. PROTECTED ROUTES (Require Auth) ────────────────────────────────
// Any route below 'router.use(protect)' will require a Bearer Token.

router.use(protect);

// Populate Flutter Workshop dropdown
router.get('/voices', ctrl.getVoices);

// Draft preview for the Workshop
router.get('/draft/:novelId/:chapterId', ctrl.getDraftPreview);

// Status and specific Auvie document lookups
router.get('/:id/status', ctrl.getStatus);
router.get('/:id', ctrl.getAuvie);

// Audio generation
router.post('/generate/:novelId/:chapterId', ctrl.generateAuvie);

// Commerce
router.post('/:id/purchase', ctrl.purchaseAuvie);

// Persistent Workshop edits
router.put('/:id/segments', ctrl.updateSegments);

module.exports = router;