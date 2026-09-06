const express = require("express");
const helmet = require("helmet");
const repository = require("./repositories/users");
const { authenticate } = require("./middleware/auth");
const { createUserRouter } = require("./routes/users");
const { createNewsRouter } = require("./routes/news");
const { createNewsService } = require("./services/news");
const { HttpError } = require("./errors");

function createApp(options = {}) {
  const secret = options.jwtSecret || process.env.JWT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters");
  const users = options.users || repository;
  const news =
    options.news || createNewsService({ apiKey: process.env.NEWS_API_KEY });
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "16kb" }));
  const auth = authenticate(users, secret);
  app.use(createUserRouter({ users, secret, auth }));
  app.use("/news", createNewsRouter({ news, auth }));
  app.use((req, res, next) => next(new HttpError(404, "Route not found")));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    const message =
      error.type === "entity.parse.failed"
        ? "Invalid JSON body"
        : status >= 500 && !(error instanceof HttpError)
          ? "Internal server error"
          : error.message;
    res.status(status).json({ error: { message } });
  });
  return app;
}
module.exports = { createApp };
