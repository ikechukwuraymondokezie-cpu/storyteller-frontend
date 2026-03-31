const Book = require('../models/Book');

/**
 * @desc    Get all books for the logged-in user
 * @route   GET /api/books
 * @access  Private
 */
exports.getBooks = async (req, res) => {
    try {
        // Use the index { user: 1, createdAt: -1 } for fast sorting
        const books = await Book.find({ user: req.user.id }).sort('-createdAt');

        res.status(200).json({
            success: true,
            count: books.length,
            books: books
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching library" });
    }
};

/**
 * @desc    Upload/Create a new book record
 * @route   POST /api/books
 * @access  Private
 */
exports.createBook = async (req, res) => {
    try {
        // When creating, we pull the user ID from the 'protect' middleware
        const newBook = await Book.create({
            ...req.body,
            user: req.user.id, // Mandatory owner link
            lastAccessed: Date.now()
        });

        res.status(201).json({
            success: true,
            data: newBook
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * @desc    Update reading progress (Continue Listening)
 * @route   PATCH /api/books/:id/progress
 */
exports.updateProgress = async (req, res) => {
    try {
        const { progress, chapter } = req.body;
        
        const book = await Book.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id }, // Security: Must own the book
            { 
                readingProgress: progress, 
                currentChapter: chapter,
                lastAccessed: Date.now() 
            },
            { new: true }
        );

        if (!book) return res.status(404).json({ message: "Book not found" });
        
        res.json({ success: true, data: book });
    } catch (error) {
        res.status(500).json({ message: "Update failed" });
    }
};

/**
 * @desc    Delete a book
 */
exports.deleteBook = async (req, res) => {
    try {
        // Find the book AND verify it belongs to this user in one query
        const book = await Book.findOneAndDelete({ _id: req.params.id, user: req.user.id });

        if (!book) {
            return res.status(404).json({ message: "Book not found or unauthorized" });
        }

        res.json({ success: true, message: "Book deleted" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};