'use strict';

const fastify = require('fastify');
const { LRUCache } = require('./cache');
const { RateLimiter } = require('./security');
const { registerRoutes } = require('./routes');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CACHE_MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE || '500', 10);
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '300000', 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

const app = fastify({
  logger: true,
  trustProxy: true,
});

const cache = new LRUCache(CACHE_MAX_SIZE, CACHE_TTL_MS);
const rateLimiter = new RateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

registerRoutes(app, { cache, rateLimiter });

// Global error handler
app.setErrorHandler((error, _req, reply) => {
  app.log.error(error);
  const { renderError } = require('./render');
  reply.status(500).type('text/html; charset=utf-8').send(renderError(500, 'Internal server error'));
});

async function start() {
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`vxsharkey listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

module.exports = { app, cache, rateLimiter };
