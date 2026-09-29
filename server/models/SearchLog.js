const mongoose = require("mongoose");

const searchLogSchema = new mongoose.Schema(
  {
    query: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    domainId: { type: mongoose.Schema.Types.ObjectId, ref: "Domain" },
    highestSimilarity: { type: Number, default: 0 },
    resultsCount: { type: Number, default: 0 },
    feedback: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SearchLog", searchLogSchema);
