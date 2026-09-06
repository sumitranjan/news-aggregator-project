const jwt = require("jsonwebtoken");
const { HttpError, asyncHandler } = require("../errors");

function authenticate(users, secret) {
  return asyncHandler(async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get("Authorization") || "");
    if (!match) throw new HttpError(401, "A Bearer token is required");
    let payload;
    try {
      payload = jwt.verify(match[1], secret, {
        algorithms: ["HS256"],
        issuer: "news-aggregator",
        audience: "news-aggregator-api",
      });
    } catch {
      throw new HttpError(401, "Invalid or expired token");
    }
    if (!/^[a-f0-9]{24}$/i.test(payload.sub || ""))
      throw new HttpError(401, "Invalid token subject");
    req.user = await users.findById(payload.sub);
    if (!req.user) throw new HttpError(401, "User no longer exists");
    next();
  });
}
module.exports = { authenticate };
