const User = require('../models/User');
const Book = require('../models/Book'); // Assuming your book model is exported

exports.getProfile = async (req, res) => {
    try {
        // req.user comes from the protect middleware
        const user = await User.findById(req.user.id).select('-password');

        // Calculate stats on the fly
        const bookCount = await Book.countDocuments({ user: req.user.id });

        res.json({
            ...user._doc,
            stats: {
                totalBooks: bookCount,
                // Add more stats here as we build them
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching profile" });
    }
};