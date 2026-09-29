const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const path = require("path");
const fs = require("fs");

const domainRoutes = require("./routes/domainRoutes");
const authRoutes = require("./routes/authRoutes");
const resourceRoutes = require("./routes/resourceRoutes");
const searchRoutes = require("./routes/searchRoutes");
const assistantRoutes = require("./routes/assistantRoutes");

const app = express();

// ==========================================
// UPLOADS FOLDER
// ==========================================

const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, {
        recursive: true
    });
}

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());

app.use(express.json());

app.use(
    "/uploads",
    express.static(uploadsDir)
);

// ==========================================
// API ROUTES
// ==========================================

app.use(
    "/api/domains",
    domainRoutes
);

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/resources",
    resourceRoutes
);

app.use(
    "/api/search",
    searchRoutes
);

app.use(
    "/api/assistant",
    assistantRoutes
);

// ==========================================
// MONGODB CONNECTION
// ==========================================

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log(
            "MongoDB connected successfully"
        );
    })
    .catch((error) => {
        console.error(
            "MongoDB connection failed:",
            error.message
        );
    });

// ==========================================
// ROOT ROUTE
// ==========================================

app.get("/", (req, res) => {
    res.json({
        message:
            "Semantic Search Platform Backend is running"
    });
});

// ==========================================
// SERVER
// ==========================================

const PORT =
    process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `Server running on http://localhost:${PORT}`
    );
});
