require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors({
    origin: [
        "https://storyteller-b1i3.onrender.com",
        "http://localhost:5173",
        "https://storyteller-frontend-x65b.onrender.com"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true
}));

// Capture raw body for webhook signature verification
app.use(express.json({
    limit: '50mb',
    verify: (req, res, buf) => { req.rawBody = buf; }
}));

/* -------------------- UPLOADS & STATIC FILES -------------------- */
const uploadsBase = path.join(__dirname, "uploads");
const uploadDir = path.join(uploadsBase, "pdfs");
const coversDir = path.join(uploadsBase, "covers");

fs.ensureDirSync(uploadDir);
fs.ensureDirSync(coversDir);

app.use("/uploads", express.static(uploadsBase));

/* -------------------- ROUTES -------------------- */

// Helper — logs clearly if a route file fails to load instead of crashing
function safeRequire(routePath) {
    try {
        const mod = require(routePath);
        if (typeof mod !== 'function' && typeof mod !== 'object') {
            console.error(`Route module did not export a router: ${routePath}`);
            return null;
        }
        return mod;
    } catch (err) {
        console.error(`Failed to load route: ${routePath} — ${err.message}`);
        return null;
    }
}

const userRoutes = safeRequire("./routes/userRoutes");
const authRoutes = safeRequire("./routes/authRoutes");
const bookRoutes = safeRequire("./routes/book_Routes");
const novelRoutes = safeRequire("./routes/novelRoutes");
const auvieRoutes = safeRequire("./routes/auvieRoutes");
const snippetRoutes = safeRequire("./routes/snippetRoutes");
const coinRoutes = safeRequire("./routes/coinRoutes");
const f3Routes = safeRequire("./routes/f3Routes");

if (authRoutes) app.use("/api/auth", authRoutes);
if (userRoutes) app.use("/api/users", userRoutes);
if (bookRoutes) app.use("/api/books", bookRoutes);
if (novelRoutes) app.use("/api/f3/novels", novelRoutes);
if (auvieRoutes) app.use("/api/f3/auvies", auvieRoutes);
if (snippetRoutes) app.use("/api/f3/snippets", snippetRoutes);
if (coinRoutes) app.use("/api/f3/coins", coinRoutes);
if (f3Routes) app.use("/api/f3", f3Routes);

/* -------------------- MONGODB -------------------- */
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected & Routes delegated"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

/* -------------------- SERVER START -------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    try {
        await fs.emptyDir(uploadDir);
        await fs.emptyDir(coversDir);
        console.log("🧹 Initial cleanup complete");
    } catch (e) {
        console.warn("⚠️ Initial cleanup failed:", e.message);
    }
});