const { Router } = require("express");
const { HttpError, asyncHandler } = require("../errors");

function createNewsRouter({ news, auth }) {
  const router = Router();

  router.get(
    "/",
    auth,
    asyncHandler(async (req, res) =>
      res.json({ news: await news.fetch(req.user) }),
    ),
  );
  router.get(
    "/search/:keyword",
    auth,
    asyncHandler(async (req, res) => {
      const keyword = req.params.keyword.trim();
      if (!/^[\p{L}\p{N} -]{1,60}$/u.test(keyword))
        throw new HttpError(
          400,
          "Keyword must be 1-60 letters, numbers, spaces or hyphens",
        );
      res.json({ news: await news.fetch(req.user, keyword) });
    }),
  );

  return router;
}

module.exports = { createNewsRouter };
