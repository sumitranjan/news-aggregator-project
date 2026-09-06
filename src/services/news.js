const axios = require("axios");
const { HttpError } = require("../errors");

function createNewsService({ apiKey, client = axios, ttl = 300000 }) {
  const cache = new Map();
  return {
    async fetch({ categories, languages }, keyword) {
      if (!apiKey) throw new HttpError(503, "News service is not configured");
      const topicQuery = categories.length
        ? categories.map((topic) => `"${topic}"`).join(" OR ")
        : "news";
      const q = keyword ? `"${keyword}" AND (${topicQuery})` : topicQuery;
      const key = JSON.stringify([q, [...languages].sort()]);
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) return cached.articles;
      try {
        const responses = await Promise.all(
          [...new Set(languages)].map((language) =>
            client.get("https://newsapi.org/v2/everything", {
              headers: { "X-Api-Key": apiKey },
              params: { q, language, sortBy: "publishedAt", pageSize: 50 },
              timeout: 10000,
            }),
          ),
        );
        if (
          responses.some(
            ({ data }) => data.status !== "ok" || !Array.isArray(data.articles),
          )
        )
          throw new Error("Invalid upstream response");
        const articles = [
          ...new Map(
            responses
              .flatMap(({ data }) => data.articles)
              .filter((article) => article && typeof article.url === "string")
              .map((article) => [article.url, article]),
          ).values(),
        ].sort(
          (a, b) =>
            (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0),
        );
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, { articles, expires: Date.now() + ttl });
        return articles;
      } catch (error) {
        if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")
          throw new HttpError(504, "News provider timed out");
        if (error.response?.status === 429)
          throw new HttpError(
            503,
            "News provider quota exceeded; try again later",
          );
        throw new HttpError(502, "Unable to fetch news from the provider");
      }
    },
  };
}
module.exports = { createNewsService };
