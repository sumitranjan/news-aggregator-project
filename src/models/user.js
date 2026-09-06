const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    categories: { type: [String], default: [] },
    languages: { type: [String], default: ["en"] },
    legacyPreferences: { type: Boolean, default: false },
  },
  { timestamps: true, strict: "throw" },
);

module.exports = mongoose.model("User", userSchema);
