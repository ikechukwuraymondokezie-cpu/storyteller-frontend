const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// This route is protected!
router.get('/profile', protect, (req, res) => {
  res.json(req.user); // Sends back the name, email, and ID of the logged-in user
});

module.exports = router;