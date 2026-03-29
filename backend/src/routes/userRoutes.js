const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Import your models
const User = require('../models/User');
const Novel = require('../models/Novel');
const Snippet = require('../models/Snippet');

// Protected route to get user profile with isWriter
router.get('/profile', protect, async (req, res) => {
  try {
    // ✅ FIX IS HERE
    const userId = req.user._id;

    // Fetch basic user info
    const user = await User.findById(userId).select('name email coins');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Count published novels & snippets
    const publishedNovels = await Novel.countDocuments({
      author: userId,
      status: 'published'
    });

    const publishedSnippets = await Snippet.countDocuments({
      author: userId,
      status: 'published'
    });

    // Send user info + isWriter flag
    res.json({
      name: user.name,
      email: user.email,
      coins: user.coins,
      isWriter: (publishedNovels + publishedSnippets) > 0
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;