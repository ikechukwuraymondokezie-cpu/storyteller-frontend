const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const User = require('../models/User');
const Novel = require('../models/Novel');
const Snippet = require('../models/Snippet');

/* ─────────────────────────────────────────────────────────────
    GET /api/users/profile
    Returns the authenticated user's profile, including:
      - isWriter flag (has published content)
      - coin balance
      - savedNovels for use in feed enrichment
───────────────────────────────────────────────────────────── */

router.get('/profile', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      'name email coins currency avatar username bio role savedNovels unlockedNovels purchasedAuvies'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [publishedNovels, publishedSnippets] = await Promise.all([
      Novel.countDocuments({ author: userId, status: 'published' }),
      Snippet.countDocuments({ author: userId, status: 'published' }),
    ]);

    res.json({
      name: user.name,
      email: user.email,
      coins: user.coins,
      currency: user.currency,
      avatar: user.avatar,
      username: user.username,
      bio: user.bio,
      role: user.role,
      isWriter: (publishedNovels + publishedSnippets) > 0,
      savedNovels: user.savedNovels ?? [],
      unlockedNovels: user.unlockedNovels ?? [],
      purchasedAuvies: user.purchasedAuvies ?? [],
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ─────────────────────────────────────────────────────────────
    POST /api/users/save-novel/:novelId
    Toggles a novel in/out of the user's saved list.
───────────────────────────────────────────────────────────── */

router.post('/save-novel/:novelId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('savedNovels');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const novelId = req.params.novelId;
    const savedSet = user.savedNovels.map(id => id.toString());
    const isSaved = savedSet.includes(novelId);

    if (isSaved) {
      user.savedNovels.pull(novelId);
    } else {
      user.savedNovels.push(novelId);
    }

    await user.save();

    res.json({ saved: !isSaved });
  } catch (err) {
    console.error('Save novel error:', err);
    res.status(500).json({ error: 'Failed to update saved novels' });
  }
});

module.exports = router;