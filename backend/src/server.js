require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");

// Route Imports
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/book_Routes");

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors({
    origin: ["https://storyteller-b1i3.onrender.com", "http://localhost:5173", "https://storyteller-frontend-x65b.onrender.com"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));

/* -------------------- UPLOADS & STATIC FILES -------------------- */
const uploadsBase = path.join(__dirname, "uploads");
const uploadDir = path.join(uploadsBase, "pdfs");
const coversDir = path.join(uploadsBase, "covers");

// Ensure directories exist
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(coversDir);

// Serve static files (covers and pdfs)
app.use("/uploads", express.static(uploadsBase));

/* -------------------- API ROUTES -------------------- */
// Authentication & User Management
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Book Logic (Delegated to routes/bookRoutes.js)
// This handles: /api/books, /api/books/:id/load-pages, /api/books/folders, etc.
app.use("/api/books", bookRoutes);

/* -------------------- MONGODB -------------------- */
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected & Routes delegated"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

/* -------------------- SERVER START -------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 Server running on port ${PORT}`);

    // Initial cleanup of temporary processing directories
    try {
        await fs.emptyDir(uploadDir);
        await fs.emptyDir(coversDir);
        console.log("🧹 Initial cleanup of uploads directory complete");
    } catch (e) {
        console.warn("⚠️ Initial cleanup failed:", e.message);
    }
});