const { z } = require("zod");
const { HttpError } = require("../errors");

const topics = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(30)
      .regex(/^[a-zA-Z0-9 -]+$/),
  )
  .max(10);
const preferences = z.union([
  topics,
  z
    .object({
      categories: topics.default([]),
      languages: z
        .array(
          z.enum([
            "ar",
            "de",
            "en",
            "es",
            "fr",
            "he",
            "it",
            "nl",
            "no",
            "pt",
            "ru",
            "sv",
            "ud",
            "zh",
          ]),
        )
        .min(1)
        .max(3)
        .default(["en"]),
    })
    .strict(),
]);
const email = z.string().trim().toLowerCase().email().max(254);
const registration = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    email,
    password: z
      .string()
      .min(8)
      .refine(
        (value) => Buffer.byteLength(value) <= 72,
        "Password must not exceed 72 bytes",
      ),
    preferences: preferences.default({ categories: [], languages: ["en"] }),
  })
  .strict();
const login = z
  .object({ email, password: z.string().min(1).max(1000) })
  .strict();
const preferenceUpdate = z.object({ preferences }).strict();
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success)
      return next(
        new HttpError(
          400,
          result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        ),
      );
    req.body = result.data;
    next();
  };
}
module.exports = { validate, registration, login, preferenceUpdate };
