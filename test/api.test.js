const t = require('tap');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app');
const { memoryUsers } = require('./helpers');
const { createNewsService } = require('../src/services/news');
const secret = 'a-test-secret-with-at-least-32-characters';

t.test('registration, authentication, preferences, and user isolation', async (t) => {
  const users = memoryUsers();
  const api = request(createApp({ users, jwtSecret: secret, news: { fetch: async (user) => [{ title: user.categories[0] }] } }));
  const credentials = { email: 'USER@example.com', password: 'correct-password' };
  const result = await api.post('/register').send(credentials);
  t.equal(result.status, 201);
  t.equal(result.body.user.email, 'user@example.com');
  t.notOk(result.body.user.passwordHash);
  const user = await users.findByEmail('user@example.com');
  t.ok(await bcrypt.compare(credentials.password, user.passwordHash));
  t.equal((await api.post('/register').send(credentials)).status, 409);
  for (const body of [{ email: 'bad', password: '12345678' }, { email: 'x@y.com', password: 'short' }, { email: {}, password: '12345678' }, { email: 'x@y.com', password: 'a'.repeat(73) }, {}]) {
    t.equal((await api.post('/register').send(body)).status, 400);
  }
  t.equal((await api.post('/login').send({ ...credentials, password: 'wrong' })).status, 401);
  const login = await api.post('/login').send(credentials);
  t.equal(login.status, 200);
  const token = login.body.token;
  t.equal(jwt.verify(token, secret).sub, user._id);
  const auth = { Authorization: `Bearer ${token}` };
  const preferences = { categories: ['science', 'technology'], languages: ['en', 'de'] };
  t.equal((await api.put('/preferences').set(auth).send({ preferences })).status, 200);
  t.same((await api.get('/preferences').set(auth)).body.preferences, preferences);
  t.same((await api.get('/news').set(auth)).body.news, [{ title: 'science' }]);
  t.equal((await api.get('/news/search/space').set(auth)).status, 200);
  for (const preferences of [null, 'sports', [3], { categories: [], languages: ['xx'] }, { categories: [], languages: [] }, { other: true }]) {
    t.equal((await api.put('/preferences').set(auth).send({ preferences })).status, 400);
  }
  await api.post('/register').send({ email: 'other@example.com', password: 'correct-password' });
  const other = await api.post('/login').send({ email: 'other@example.com', password: 'correct-password' });
  t.same((await api.get('/preferences').set('Authorization', `Bearer ${other.body.token}`)).body.preferences, { categories: [], languages: ['en'] });
  for (const path of ['/preferences', '/news', '/news/search/test']) {
    t.equal((await api.get(path)).status, 401);
    t.equal((await api.get(path).set('Authorization', 'Bearer invalid')).status, 401);
  }
  const expired = jwt.sign({}, secret, { subject: user._id, expiresIn: -1, issuer: 'news-aggregator', audience: 'news-aggregator-api' });
  t.equal((await api.get('/preferences').set('Authorization', `Bearer ${expired}`)).status, 401);
  t.equal((await api.post('/register').set('Content-Type', 'application/json').send('{')).status, 400);
  t.equal((await api.get('/missing')).status, 404);
  users.rows.delete(user._id);
  t.equal((await api.get('/preferences').set(auth)).status, 401);
});

t.test('news requests, cache, and provider failures', async (t) => {
  const calls = [];
  const client = { async get(url, options) {
    calls.push({ url, ...options });
    return { data: { status: 'ok', articles: [{ url: 'https://example.com/article', title: 'Science' }] } };
  } };
  const news = createNewsService({ apiKey: 'test-key', client });
  const prefs = { categories: ['science'], languages: ['en', 'de'] };
  t.equal((await news.fetch(prefs)).length, 1);
  await news.fetch(prefs);
  t.equal(calls.length, 2, 'repeated fetch uses cache');
  t.equal(calls[0].params.q, '"science"');
  t.same(calls.map((call) => call.params.language), ['en', 'de']);
  t.equal(calls[0].headers['X-Api-Key'], 'test-key');
  await news.fetch(prefs, 'space');
  t.equal(calls[2].params.q, '"space" AND ("science")');
  await t.rejects(createNewsService({}).fetch(prefs), { status: 503 });
  for (const [error, status] of [[new Error('secret provider details'), 502], [{ code: 'ECONNABORTED' }, 504], [{ response: { status: 429 } }, 503]]) {
    const failing = createNewsService({ apiKey: 'key', client: { get: async () => { throw error; } } });
    await t.rejects(failing.fetch(prefs), { status });
  }
  const malformed = createNewsService({ apiKey: 'key', client: { get: async () => ({ data: { status: 'error' } }) } });
  await t.rejects(malformed.fetch(prefs), { status: 502 });
  const noCache = createNewsService({ apiKey: 'key', client, ttl: 0 });
  const before = calls.length;
  await noCache.fetch(prefs);
  await noCache.fetch(prefs);
  t.equal(calls.length - before, 4, 'expired entries are fetched again');
});

t.test('configuration fails closed', async (t) => {
  t.throws(() => createApp({ jwtSecret: 'short' }), /JWT_SECRET/);
});
