const User = require('../models/User');
const Book = require('../models/Book');

/**
 * @desc    Get current user profile & stats
 * @route   GET /api/users/profile
 * @access  Private
 */
exports.getProfile = async (req, res) => {
    try {
        // 1. Fetch user (password is already hidden by Schema, but -password is a good safety net)
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // 2. Calculate dynamic stats
        // This counts how many books/novels have this user's ID as the owner
        const bookCount = await Book.countDocuments({ user: req.user.id });

        // 3. Construct the response
        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                username: user.username || "story_teller", // Fallback for old users
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                bio: user.bio,
                coins: user.coins,
                currency: user.currency,
                followersCount: user.followers.length,
                followingCount: user.following.length,
                stats: {
                    totalBooks: bookCount,
                    unlockedNovels: user.unlockedNovels.length,
                    purchasedAuvies: user.purchasedAuvies.length
                }
            }
        });
    } catch (error) {
        console.error("Profile Fetch Error:", error);
        res.status(500).json({ message: "Error fetching profile" });
    }
};