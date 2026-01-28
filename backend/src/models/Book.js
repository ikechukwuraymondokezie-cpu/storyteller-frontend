const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        words: { type: String },          // optional, can store word count
        cover: { type: String },          // path to thumbnail image
        pdfPath: { type: String },        // path to uploaded PDF
        folder: { type: String, default: "default" },
        downloads: { type: Number, default: 0 },
        ttsRequests: { type: Number, default: 0 }, // track TTS requests
    },
    { timestamps: true }
);

module.exports = mongoose.model("Book", bookSchema);
