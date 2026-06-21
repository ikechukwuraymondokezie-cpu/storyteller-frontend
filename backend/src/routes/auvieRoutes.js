/* ── AUVIE ROUTES ────────────────────────────────────────────────────────
 * HTTP wiring only — no business logic lives here.
 * All logic is in auvieController.js.
 * ─────────────────────────────────────────────────────────────────────── */

const express = require('express');
const router = express.Router();
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/auvieController');

// ── PUBLIC ROUTES (token optional — enriches author/purchase checks) ───
router.get('/sounds', ctrl.getSounds);

// optionalProtect: sets req.user if token present, never blocks if absent.
// This is critical — without it, authors always appear as guests on these
// public routes and get the paywall even for their own content.
router.get('/chapter/:chapterId', optionalProtect, ctrl.getAuvieByChapter);
router.get('/novel/:novelId', optionalProtect, ctrl.getAuvieByNovel);

// ── PROTECTED ROUTES (token required) ─────────────────────────────────
router.get('/novel/:novelId/chapters', protect, ctrl.getChapterAuvieStatuses);
router.get('/voices', protect, ctrl.getVoices);
router.get('/draft/:novelId/:chapterId', protect, ctrl.getDraftPreview);

// Generic ID lookups — must come AFTER specific named routes
router.get('/:id/status', protect, ctrl.getStatus);
router.get('/:id', optionalProtect, ctrl.getAuvie);

router.post('/generate/:novelId/:chapterId', protect, ctrl.generateAuvie);
router.post('/:id/purchase', protect, ctrl.purchaseAuvie);
router.put('/:id/segments', protect, ctrl.updateSegments);

module.exports = router;