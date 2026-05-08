/* ── AUVIE ROUTES ────────────────────────────────────────────────────────
 * HTTP wiring only — no business logic lives here.
 * All logic is in auvieController.js.
 * ─────────────────────────────────────────────────────────────────────── */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/auvieController');

// ── 1. PUBLIC ROUTES ──────────────────────────────────────────────────
// These must be accessible without a token for immediate UI checks.

router.get('/sounds', ctrl.getSounds);

// Specific lookups must come BEFORE generic /:id routes
router.get('/chapter/:chapterId', ctrl.getAuvieByChapter);
router.get('/novel/:novelId', ctrl.getAuvieByNovel);


// ── 2. PROTECTED ROUTES (Require Auth) ────────────────────────────────
router.use(protect);

// Status list for a specific novel's chapters
router.get('/novel/:novelId/chapters', ctrl.getChapterAuvieStatuses);

// Populate Flutter Workshop dropdown
router.get('/voices', ctrl.getVoices);

// Draft preview for the Workshop
router.get('/draft/:novelId/:chapterId', ctrl.getDraftPreview);

// Generic ID lookups (Keep these at the bottom)
router.get('/:id/status', ctrl.getStatus);
router.get('/:id', ctrl.getAuvie);

// Audio generation
router.post('/generate/:novelId/:chapterId', ctrl.generateAuvie);

// Commerce
router.post('/:id/purchase', ctrl.purchaseAuvie);

// Persistent Workshop edits
router.put('/:id/segments', ctrl.updateSegments);

module.exports = router;