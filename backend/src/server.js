require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");

// ── ROUTE IMPORTS ─────────────────────────────────────────────────────
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/book_Routes");

// F3 — Fun Fiction & Fallacies
const novelRoutes = require("./routes/novelRoutes");
const auvieRoutes = require("./routes/auvieRoutes");
const snippetRoutes = require("./routes/snippetRoutes");
const coinRoutes = require("./routes/coinRoutes");
const f3Routes = require("./routes/f3Routes");

const app = express();

/* -------------------- WEBHOOK ROUTES (raw body — MUST be before express.json) -------------------- */
// Stripe and Paystack webhooks need the raw request body to verify signatures.
// These must be registered BEFORE express.json() parses the body.
app.post(
    "/api/f3/coins/stripe/webhook",
    express.raw({ type: "application/json" }),
    require("./routes/coinRoutes").stripeWebhook
);
app.post(
    "/api/f3/coins/paystack/webhook",
    express.raw({ type: "application/json" }),
    require("./routes/coinRoutes").paystackWebhook
);

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
app.use(express.json({ limit: '50mb' }));

/* -------------------- UPLOADS & STATIC FILES -------------------- */
const uploadsBase = path.join(__dirname, "uploads");
const uploadDir = path.join(uploadsBase, "pdfs");
const coversDir = path.join(uploadsBase, "covers");

fs.ensureDirSync(uploadDir);
fs.ensureDirSync(coversDir);

app.use("/uploads", express.static(uploadsBase));

/* -------------------- API ROUTES -------------------- */

// Auth & Users
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Private library (book import + reader)
app.use("/api/books", bookRoutes);

// F3 — public creative platform
app.use("/api/f3/novels", novelRoutes);
app.use("/api/f3/auvies", auvieRoutes);
app.use("/api/f3/snippets", snippetRoutes);
app.use("/api/f3/coins", coinRoutes);
app.use("/api/f3", f3Routes);    // feed, search, profiles — must be last

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
        console.log("🧹 Initial cleanup of uploads directory complete");
    } catch (e) {
        console.warn("⚠️ Initial cleanup failed:", e.message);
    }
});