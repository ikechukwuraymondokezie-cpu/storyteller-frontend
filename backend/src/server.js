require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");

const app = express();

app.use(cors({
    origin: ["https://storyteller-b1i3.onrender.com", "http://localhost:5173", "https://storyteller-frontend-x65b.onrender.com"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
}));

app.use(express.json({
    limit: '50mb',
    verify: (req, res, buf) => { req.rawBody = buf; }
}));

const uploadsBase = path.join(__dirname, "uploads");
const uploadDir = path.join(uploadsBase, "pdfs");
const coversDir = path.join(uploadsBase, "covers");
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(coversDir);
app.use("/uploads", express.static(uploadsBase));

// Core routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/books", require("./routes/book_Routes"));

// F3 routes
app.use("/api/f3/novels", require("./routes/novelRoutes"));
app.use("/api/f3/auvies", require("./routes/auvieRoutes"));
app.use("/api/f3/snippets", require("./routes/snippetRoutes"));
app.use("/api/f3/coins", require("./routes/coinRoutes"));
app.use("/api/f3", require("./routes/f3Routes"));

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.error("❌ MongoDB error:", err));

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    try {
        await fs.emptyDir(uploadDir);
        await fs.emptyDir(coversDir);
        console.log("🧹 Cleanup complete");
    } catch (e) {
        console.warn("⚠️ Cleanup failed:", e.message);
    }
});