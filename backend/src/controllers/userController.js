const User = require('../models/User');
const Book = require('../models/Book');

/**
 * @desc    Get current user profile & stats
 * @route   GET /api/users/profile
 * @access  Private
 */
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const bookCount = await Book.countDocuments({ user: req.user.id });

        // Return fields at the TOP level (not nested under 'user')
        // so Flutter's fetchUserProfile() can read name, coins, etc. directly.
        res.json({
            id: user._id,
            name: user.name,
            username: user.username || 'story_teller',
            email: user.email,
            avatar: user.avatar,
            role: user.role,
            bio: user.bio,
            coins: user.coins,
            currency: user.currency,
            isSubscribed: user.isSubscribed ?? false,
            subscriptionExpiry: user.subscriptionExpiry ?? null,
            followersCount: user.followers?.length ?? 0,
            followingCount: user.following?.length ?? 0,
            stats: {
                totalBooks: bookCount,
                unlockedNovels: user.unlockedNovels?.length ?? 0,
                purchasedAuvies: user.purchasedAuvies?.length ?? 0,
            },
        });
    } catch (error) {
        console.error('Profile Fetch Error:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
};