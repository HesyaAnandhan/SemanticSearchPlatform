const express = require("express");
const Domain = require("../models/Domain");
const Resource = require("../models/Resource");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Domain name is required"
            });
        }

        const domain = new Domain({
            name,
            description,
            createdBy: req.user.userId
        });

        await domain.save();

        res.status(201).json(domain);
    } catch (error) {
        res.status(500).json({
            message: "Failed to create domain",
            error: error.message
        });
    }
});

router.get("/", authMiddleware, async (req, res) => {
    try {
        const domains = await Domain.find({
            createdBy: req.user.userId
        }).sort({ createdAt: -1 });

        const domainsWithCounts = await Promise.all(
            domains.map(async (domain) => {
                const resourceCount = await Resource.countDocuments({
                    domainId: domain._id
                });

                return {
                    ...domain.toObject(),
                    resourceCount
                };
            })
        );

        res.json(domainsWithCounts);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch domains",
            error: error.message
        });
    }
});

const fs = require("fs");

router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const domain = await Domain.findOne({
            _id: req.params.id,
            createdBy: req.user.userId
        });

        if (!domain) {
            return res.status(404).json({
                message: "Domain not found"
            });
        }

        const resourceCount = await Resource.countDocuments({
            domainId: domain._id
        });

        res.json({
            ...domain.toObject(),
            resourceCount
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch domain",
            error: error.message
        });
    }
});

router.put("/:id", authMiddleware, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: "Domain name is required"
            });
        }

        const domain = await Domain.findOneAndUpdate(
            {
                _id: req.params.id,
                createdBy: req.user.userId
            },
            {
                name: name.trim(),
                description: description !== undefined ? description.trim() : ""
            },
            { new: true }
        );

        if (!domain) {
            return res.status(404).json({
                message: "Domain not found"
            });
        }

        const resourceCount = await Resource.countDocuments({
            domainId: domain._id
        });

        res.json({
            message: "Domain updated successfully",
            domain: {
                ...domain.toObject(),
                resourceCount
            }
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to update domain",
            error: error.message
        });
    }
});

router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const domain = await Domain.findOne({
            _id: req.params.id,
            createdBy: req.user.userId
        });

        if (!domain) {
            return res.status(404).json({
                message: "Domain not found"
            });
        }

        // Clean up all resources belonging to this domain, including any uploaded files
        const resources = await Resource.find({ domainId: req.params.id });
        for (const resItem of resources) {
            if (resItem.filePath && fs.existsSync(resItem.filePath)) {
                try {
                    fs.unlinkSync(resItem.filePath);
                } catch (err) {
                    console.error("Failed to delete file:", resItem.filePath, err);
                }
            }
        }
        await Resource.deleteMany({ domainId: req.params.id });

        await Domain.deleteOne({ _id: req.params.id });

        res.json({
            message: "Domain and all associated resources deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete domain",
            error: error.message
        });
    }
});

module.exports = router;