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
router.get('/draft/:novelId', protect, ctrl.getDraftPreview);
router.get('/:id/status', protect, ctrl.getStatus);
router.get('/:id', protect, ctrl.getAuvie);

router.post('/generate/:novelId', protect, ctrl.generateAuvie);
router.post('/:id/purchase', protect, ctrl.purchaseAuvie);

router.put('/:id/segments', protect, ctrl.updateSegments);

module.exports = router;