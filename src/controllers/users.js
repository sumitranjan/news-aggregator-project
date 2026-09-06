const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { HttpError } = require("../errors");

const toStored = (value) =>
  Array.isArray(value)
    ? { categories: value, languages: ["en"], legacyPreferences: true }
    : { ...value, legacyPreferences: false };
const toPreferences = (user) =>
  user.legacyPreferences
    ? user.categories
    : { categories: user.categories, languages: user.languages };

function createUserController(users, secret) {
  return {
    async register(req, res) {
      const { email, name, password, preferences } = req.body;
      const passwordHash = await bcrypt.hash(password, 12);
      let user;
      try {
        user = await users.create({
          email,
          name,
          passwordHash,
          ...toStored(preferences),
        });
      } catch (error) {
        if (error.code === 11000)
          throw new HttpError(409, "Email is already registered");
        throw error;
      }
      res.status(req.path === "/users/signup" ? 200 : 201).json({
        user: { id: user._id, email, name, preferences: toPreferences(user) },
      });
    },
    async login(req, res) {
      const user = await users.findByEmail(req.body.email);
      // Compare even for unknown users to reduce account enumeration through timing.
      const hash = user
        ? user.passwordHash
        : "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
      const valid = await bcrypt.compare(req.body.password, hash);
      if (!user || !valid)
        throw new HttpError(401, "Invalid email or password");
      const token = jwt.sign({}, secret, {
        algorithm: "HS256",
        subject: String(user._id),
        expiresIn: "1h",
        issuer: "news-aggregator",
        audience: "news-aggregator-api",
      });
      res.json({ token, tokenType: "Bearer", expiresIn: 3600 });
    },
    async getPreferences(req, res) {
      res.json({ preferences: toPreferences(req.user) });
    },
    async updatePreferences(req, res) {
      const user = await users.updatePreferences(
        req.user._id,
        toStored(req.body.preferences),
      );
      if (!user) throw new HttpError(401, "User no longer exists");
      res.json({ preferences: toPreferences(user) });
    },
  };
}
module.exports = { createUserController };
