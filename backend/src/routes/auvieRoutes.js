/* ── AUVIE ROUTES ────────────────────────────────────────────────────────
 * HTTP wiring only — no business logic lives here.
 * All logic is in auvieController.js.
 * ─────────────────────────────────────────────────────────────────────── */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/auvieController');

// ── Public / sound metadata ───────────────────────────────────────────
router.get('/sounds', ctrl.getSounds);

// ── Auth required ─────────────────────────────────────────────────────
router.get('/voices', protect, ctrl.getVoices);

// UPDATED: Now requires chapterId to match controller logic
router.get('/draft/:novelId/:chapterId', protect, ctrl.getDraftPreview);

router.get('/:id/status', protect, ctrl.getStatus);
router.get('/:id', protect, ctrl.getAuvie);

// UPDATED: Now requires chapterId for specific audio generation
router.post('/generate/:novelId/:chapterId', protect, ctrl.generateAuvie);

router.post('/:id/purchase', protect, ctrl.purchaseAuvie);

router.put('/:id/segments', protect, ctrl.updateSegments);

module.exports = router;