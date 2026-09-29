const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Domain",
      required: true
    },
    type: {
      type: String,
      enum: ["faq", "text", "pdf"],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      default: ""
    },
    fileName: {
      type: String,
      default: ""
    },
    filePath: {
      type: String,
      default: ""
    },
    fileUrl: {
      type: String,
      default: ""
    },
    embedding: {
      type: [Number],
      default: []
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Resource", resourceSchema);