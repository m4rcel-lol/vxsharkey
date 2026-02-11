'use strict';

const { validateInstanceDomain, validateNoteId } = require('./security');
const { fetchNote } = require('./api');
const { renderNote, renderError } = require('./render');

/**
 * Register routes on a Fastify instance.
 * @param {import('fastify').FastifyInstance} app
 * @param {{ cache: import('./cache').LRUCache, rateLimiter: import('./security').RateLimiter }} deps
 */
function registerRoutes(app, { cache, rateLimiter }) {
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

module.exports = { registerRoutes };
