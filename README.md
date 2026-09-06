# News Aggregator API

Express API with MongoDB/Mongoose persistence, bcrypt password hashing, JWT authentication, preference-based news retrieval through axios, and input validation using Zod. Includes a bounded five-minute in-process cache and keyword search.

## Setup

Requires Node.js 18+ (a supported LTS version is recommended), npm, MongoDB, and a [NewsAPI key](https://newsapi.org/register).

```sh
npm install
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set `JWT_SECRET` in `.env` to the generated random value, set `NEWS_API_KEY`, and point `MONGODB_URI` to your local MongoDB or Atlas database. Never commit `.env`.

```sh
npm start
# Development with automatic restart:
npm run dev
# Tests:
npm run test
```

The server defaults to `http://localhost:3000`. It connects to MongoDB and initializes the unique email index before listening. Missing/short JWT secrets or database connection failures stop startup. Without a news key, news endpoints return 503; authentication and preferences still work.

| Variable | Meaning |
| --- | --- |
| `PORT` | HTTP port, default 3000 |
| `MONGODB_URI` | Required MongoDB connection URI |
| `JWT_SECRET` | Required random signing secret, at least 32 characters |
| `NEWS_API_KEY` | Required to retrieve live news |

## Structure

```text
app.js                   Application factory export
src/app.js               Express setup and router mounting
src/routes/              Express routers for users and news
src/server.js            Database connection and server lifecycle
src/controllers/users.js Registration, login, and preferences
src/middleware/          JWT verification and request validation
src/models/user.js       Mongoose user schema
src/repositories/users.js MongoDB queries
src/services/news.js     NewsAPI requests and cache
src/errors.js            HTTP errors and async handler
test/                    API and service tests
```

## Endpoints

Send JSON bodies with `Content-Type: application/json`. Protected endpoints require `Authorization: Bearer <token>`.

| Method | Path | Authentication | Success |
| --- | --- | --- | --- |
| POST | `/register` | Public | 201, `{ "user": { "id", "email", "name", "preferences" } }` |
| POST | `/login` | Public | 200, `{ "token", "tokenType": "Bearer", "expiresIn": 3600 }` |
| GET | `/preferences` | Required | 200, `{ "preferences": ... }` |
| PUT | `/preferences` | Required | 200, updated preferences |
| GET | `/news` | Required | 200, `{ "news": [...] }` |
| GET | `/news/search/:keyword` | Required | 200, `{ "news": [...] }` |

Compatibility aliases: `/users/signup` (returns 200), `/users/login`, and `/users/preferences`.

### Registration and Login

```json
{
  "name": "Clark Kent",
  "email": "clark@example.com",
  "password": "a-long-unique-password",
  "preferences": { "categories": ["science", "technology"], "languages": ["en"] }
}
```

Name and initial preferences are optional. Email is normalized to lowercase. Passwords require at least 8 characters and at most 72 UTF-8 bytes, and are hashed with bcrypt cost 12. Login accepts only `email` and `password`. Tokens expire after one hour; login again to obtain a new token. Authentication endpoints share a limit of 30 requests per IP per 15 minutes.

### Preferences

PUT replaces the preferences with:

```json
{ "preferences": { "categories": ["science", "sports"], "languages": ["en", "fr"] } }
```

Categories are topic keywords: up to 10 strings, each 1-30 ASCII letters, digits, spaces, or hyphens. Languages accept 1-3 codes from `ar de en es fr he it nl no pt ru sv ud zh`. Omitted categories default to `[]`; omitted languages default to `["en"]`. A legacy array such as `{ "preferences": ["movies", "comics"] }` is also supported and uses English.

### News and Search

Uses [NewsAPI Everything](https://newsapi.org/docs/endpoints/everything) because it supports both keyword queries and language filtering. Categories are matched as quoted topics joined with OR, not NewsAPI's fixed top-headline categories. With no topics, the query is `news`. Search keywords are combined with the topic query using AND; keywords allow 1-60 letters, digits, spaces, or hyphens.

Each cache miss makes one request per distinct preferred language, fetching up to 50 articles per language. Results are deduplicated by URL and sorted newest first. The response contains provider article fields such as `title`, `url`, `source`, `publishedAt`, and `description`. The cache retains at most 100 query/language combinations for five minutes and is process-local. Requests time out after 10 seconds. No periodic refresh is enabled, to avoid consuming quota in the background. Read/favorite tracking is not implemented.

## Errors

Errors use `{ "error": { "message": "..." } }`.

| Status | Meaning |
| --- | --- |
| 400 | Invalid/missing input or malformed JSON |
| 401 | Missing, invalid, or expired token; invalid login |
| 404 | Unknown route |
| 409 | Email already registered |
| 413 | JSON body exceeds 16 KB |
| 429 | Authentication rate limit exceeded |
| 500 | Unexpected internal failure |
| 502 | News provider failed or returned an invalid response |
| 503 | Missing news configuration or provider quota exhausted |
| 504 | News provider timeout |

## Testing and Deployment Notes

Tests inject an isolated in-memory repository and mock the news provider. They verify HTTP contracts, hashing, validation, authentication, user isolation, caching, and provider errors without external credentials. They do not verify connectivity or persistence against a live MongoDB instance. The existing compatibility tests are retained; their forced `process.exit(0)` was removed so failures can propagate normally.

Use HTTPS in deployment. For multiple server instances, use a shared rate-limit/cache store. Configure Express proxy trust for your specific ingress before relying on client-IP rate limits behind a proxy. The current MongoDB schema stores one document per user with embedded preferences and a unique email index.
