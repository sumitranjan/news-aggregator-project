const User = require("../models/user");

module.exports = {
  create: (data) => User.create(data),
  findByEmail: (email) =>
    User.findOne({ email }).select("+passwordHash").lean(),
  findById: (id) => User.findById(id).lean(),
  updatePreferences: (id, preferences) =>
    User.findByIdAndUpdate(
      id,
      { $set: preferences },
      { new: true, runValidators: true },
    ).lean(),
};
