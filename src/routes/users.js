const { Router } = require("express");
const { rateLimit } = require("express-rate-limit");
const { createUserController } = require("../controllers/users");
const {
  validate,
  registration,
  login,
  preferenceUpdate,
} = require("../middleware/validation");
const { asyncHandler } = require("../errors");

function createUserRouter({ users, secret, auth }) {
  const router = Router();
  const controller = createUserController(users, secret);
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: { message: "Too many authentication attempts; try again later" },
    },
  });

  router.post(
    ["/register", "/users/signup"],
    limiter,
    validate(registration),
    asyncHandler(controller.register),
  );
  router.post(
    ["/login", "/users/login"],
    limiter,
    validate(login),
    asyncHandler(controller.login),
  );
  router.get(
    ["/preferences", "/users/preferences"],
    auth,
    asyncHandler(controller.getPreferences),
  );
  router.put(
    ["/preferences", "/users/preferences"],
    auth,
    validate(preferenceUpdate),
    asyncHandler(controller.updatePreferences),
  );

  return router;
}

module.exports = { createUserRouter };
