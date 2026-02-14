'use strict';

const { validateInstanceDomain, validateNoteId } = require('./security');
const { fetchNote } = require('./api');
const { renderNote, renderError, renderAbout } = require('./render');

/**
 * Known bot/crawler user-agent patterns.
 * These are embed scrapers that should receive the HTML embed page.
 * Regular browsers are redirected to the original note.
 */
const BOT_USER_AGENTS = [
  'bot', 'crawler', 'spider', 'curl', 'wget',
  'facebookexternalhit', 'twitterbot', 'linkedinbot',
  'slackbot', 'telegrambot', 'whatsapp', 'discordbot',
  'embedly', 'quora', 'showyoubot', 'outbrain',
  'pinterest', 'applebot', 'redditbot', 'bingbot',
  'googlebot', 'yandexbot', 'duckduckbot',
  'baiduspider', 'sogou', 'ia_archiver',
  'mj12bot', 'ahrefsbot', 'semrushbot',
  'python-requests', 'go-http-client', 'httpie',
  'postmanruntime', 'insomnia',
];

/**
 * Check if a User-Agent string belongs to a bot/crawler.
 * @param {string} userAgent
 * @returns {boolean}
 */
function isBot(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length === 0) return true;
  const lower = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some((bot) => lower.includes(bot));
}

/**
 * Register routes on a Fastify instance.
 * @param {import('fastify').FastifyInstance} app
 * @param {{ cache: import('./cache').LRUCache, rateLimiter: import('./security').RateLimiter }} deps
 */
function registerRoutes(app, { cache, rateLimiter }) {
  // Landing / about page
  app.get('/', async (_req, reply) => {
    reply.type('text/html; charset=utf-8').header('Cache-Control', 'public, max-age=3600');
    return renderAbout();
  });

  // Health check
  app.get('/health', async (_req, reply) => {
    reply.type('application/json').send({ status: 'ok' });
  });

  // Metrics endpoint
  app.get('/metrics', async (_req, reply) => {
    reply.type('application/json').send({
      cacheSize: cache.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    });
  });

  // Main note embed route
  app.get('/:instance/notes/:noteId', async (req, reply) => {
    const clientIp = req.ip;

    // Rate limiting
    const rateResult = rateLimiter.check(clientIp);
    reply.header('X-RateLimit-Remaining', String(rateResult.remaining));
    reply.header('X-RateLimit-Reset', String(Math.ceil(rateResult.resetMs / 1000)));

    if (!rateResult.allowed) {
      reply.status(429).type('text/html; charset=utf-8');
      return renderError(429, 'Too many requests. Please try again later.');
    }

    const { instance, noteId } = req.params;

    // Validate instance domain
    const domainCheck = validateInstanceDomain(instance);
    if (!domainCheck.valid) {
      reply.status(400).type('text/html; charset=utf-8');
      return renderError(400, `Invalid instance: ${domainCheck.reason}`);
    }

    // Validate note ID
    const noteIdCheck = validateNoteId(noteId);
    if (!noteIdCheck.valid) {
      reply.status(400).type('text/html; charset=utf-8');
      return renderError(400, `Invalid note ID: ${noteIdCheck.reason}`);
    }

    const noteUrl = `https://${instance}/notes/${noteId}`;

    // Redirect regular browsers to the original note (like vxtwitter)
    const userAgent = req.headers['user-agent'] || '';
    if (!isBot(userAgent)) {
      reply.redirect(noteUrl, 302);
      return;
    }

    // Check cache
    const cacheKey = `${instance}:${noteId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      reply
        .status(200)
        .type('text/html; charset=utf-8')
        .header('Cache-Control', 'public, max-age=300')
        .header('X-Cache', 'HIT');
      return cached;
    }

    // Fetch from upstream
    const result = await fetchNote(instance, noteId);

    if (!result.ok) {
      const statusCode = result.status === 404 ? 404 : 502;
      reply.status(statusCode).type('text/html; charset=utf-8');
      return renderError(statusCode, result.error);
    }

    // Render HTML
    const html = renderNote(result.note, instance);

    // Cache the response
    cache.set(cacheKey, html);

    reply
      .status(200)
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300')
      .header('X-Cache', 'MISS');
    return html;
  });

  // Catch-all for unknown routes
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).type('text/html; charset=utf-8');
    return renderError(404, 'Page not found. Use /{instance}/notes/{noteId}');
  });
}

module.exports = { registerRoutes, isBot };
