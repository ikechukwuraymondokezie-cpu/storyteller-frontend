const express = require("express");
const router = express.Router();
const Book = require("../models/Book");

// GET all books
router.get("/", async (req, res) => {
    try {
        const books = await Book.find();
        res.json(books);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// PATCH /api/books/:id/actions
router.patch("/:id/actions", async (req, res) => {
    const { id } = req.params;
    const { action } = req.body;

    if (!["download", "tts"].includes(action)) {
        return res.status(400).json({ message: "Invalid action" });
    }

    try {
        const book = await Book.findById(id);
        if (!book) return res.status(404).json({ message: "Book not found" });

        if (action === "download") book.downloads += 1;
        if (action === "tts") book.ttsCount += 1;

        await book.save();
        res.json({ message: "Action tracked", book });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
