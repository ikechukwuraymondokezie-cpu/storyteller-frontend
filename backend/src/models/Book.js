const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    words: { type: String },
    cover: { type: String },
    pdf: { type: String },           // path to uploaded PDF
    folder: { type: String, default: "default" },
    downloads: { type: Number, default: 0 },
    ttsCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Book", bookSchema);
