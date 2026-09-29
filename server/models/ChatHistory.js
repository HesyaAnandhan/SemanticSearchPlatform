const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  dateString: {
    type: String
  },
  timeString: {
    type: String
  },
  year: {
    type: Number
  },
  sources: {
    type: Array,
    default: []
  }
});

const chatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    sessionId: {
      type: String,
      required: true
    },
    title: {
      type: String,
      default: "AI Assistant Conversation"
    },
    messages: [messageSchema],
    dateFormatted: {
      type: String
    },
    timeFormatted: {
      type: String
    },
    year: {
      type: Number,
      default: () => new Date().getFullYear()
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("ChatHistory", chatHistorySchema);
