'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

// ============================================================
// Unit tests for sanitize module
// ============================================================
const { escapeHtml, sanitizeUrl, truncate } = require('../src/sanitize');

describe('sanitize', () => {
  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('escapes ampersands', () => {
      assert.equal(escapeHtml('a & b'), 'a &amp; b');
    });

    it('escapes single quotes', () => {
      assert.equal(escapeHtml("it's"), 'it&#x27;s');
    });

    it('returns empty string for non-string input', () => {
      assert.equal(escapeHtml(null), '');
      assert.equal(escapeHtml(undefined), '');
      assert.equal(escapeHtml(123), '');
    });

    it('returns empty string unchanged', () => {
      assert.equal(escapeHtml(''), '');
    });

    it('leaves safe text unchanged', () => {
      assert.equal(escapeHtml('Hello World'), 'Hello World');
    });
  });

  describe('sanitizeUrl', () => {
    it('allows https URLs', () => {
      assert.equal(sanitizeUrl('https://example.com/img.png'), 'https://example.com/img.png');
    });

    it('allows http URLs', () => {
      assert.equal(sanitizeUrl('http://example.com/img.png'), 'http://example.com/img.png');
    });

    it('rejects javascript: URLs', () => {
      assert.equal(sanitizeUrl('javascript:alert(1)'), '');
    });

    it('rejects data: URLs', () => {
      assert.equal(sanitizeUrl('data:text/html,<h1>XSS</h1>'), '');
    });

    it('rejects empty string', () => {
      assert.equal(sanitizeUrl(''), '');
    });

    it('returns empty for non-string input', () => {
      assert.equal(sanitizeUrl(null), '');
      assert.equal(sanitizeUrl(42), '');
    });

    it('escapes HTML entities in URLs', () => {
      assert.equal(sanitizeUrl('https://example.com/a&b'), 'https://example.com/a&amp;b');
    });
  });

  describe('truncate', () => {
    it('truncates long text', () => {
      const long = 'a'.repeat(400);
      const result = truncate(long, 300);
      assert.equal(result.length, 301); // 300 chars + ellipsis
      assert.ok(result.endsWith('…'));
    });

    it('leaves short text unchanged', () => {
      assert.equal(truncate('hello'), 'hello');
    });

    it('returns empty for non-string input', () => {
      assert.equal(truncate(null), '');
    });
  });
});

// ============================================================
// Unit tests for security module
// ============================================================
const { validateInstanceDomain, validateNoteId, isPrivateIPv4, isPrivateIPv6, RateLimiter } = require('../src/security');

describe('security', () => {
  describe('validateInstanceDomain', () => {
    it('accepts valid domains', () => {
      assert.deepEqual(validateInstanceDomain('sharkey.example.com'), { valid: true });
      assert.deepEqual(validateInstanceDomain('misskey.io'), { valid: true });
      assert.deepEqual(validateInstanceDomain('social.vivaldi.net'), { valid: true });
    });

    it('rejects localhost', () => {
      const r = validateInstanceDomain('localhost');
      assert.equal(r.valid, false);
    });

    it('rejects sub-localhost', () => {
      const r = validateInstanceDomain('evil.localhost');
      assert.equal(r.valid, false);
    });

    it('rejects IPv4 addresses', () => {
      const r = validateInstanceDomain('192.168.1.1');
      assert.equal(r.valid, false);
    });

    it('rejects IPv6 addresses', () => {
      const r = validateInstanceDomain('::1');
      assert.equal(r.valid, false);
    });

    it('rejects bracketed IPv6', () => {
      const r = validateInstanceDomain('[::1]');
      assert.equal(r.valid, false);
    });

    it('rejects empty strings', () => {
      const r = validateInstanceDomain('');
      assert.equal(r.valid, false);
    });

    it('rejects non-strings', () => {
      const r = validateInstanceDomain(null);
      assert.equal(r.valid, false);
    });

    it('rejects single-label hostnames', () => {
      const r = validateInstanceDomain('justoneword');
      assert.equal(r.valid, false);
    });

    it('rejects domains starting with hyphen', () => {
      const r = validateInstanceDomain('-bad.example.com');
      assert.equal(r.valid, false);
    });
  });

  describe('validateNoteId', () => {
    it('accepts valid note IDs', () => {
      assert.deepEqual(validateNoteId('9xyzabc123'), { valid: true });
      assert.deepEqual(validateNoteId('abc'), { valid: true });
    });

    it('rejects empty note IDs', () => {
      assert.equal(validateNoteId('').valid, false);
    });

    it('rejects note IDs with special characters', () => {
      assert.equal(validateNoteId('abc-def').valid, false);
      assert.equal(validateNoteId('../etc').valid, false);
      assert.equal(validateNoteId('abc def').valid, false);
    });

    it('rejects overly long note IDs', () => {
      assert.equal(validateNoteId('a'.repeat(65)).valid, false);
    });
  });

  describe('isPrivateIPv4', () => {
    it('detects 10.x.x.x', () => assert.equal(isPrivateIPv4('10.0.0.1'), true));
    it('detects 127.x.x.x', () => assert.equal(isPrivateIPv4('127.0.0.1'), true));
    it('detects 192.168.x.x', () => assert.equal(isPrivateIPv4('192.168.0.1'), true));
    it('detects 172.16-31.x.x', () => assert.equal(isPrivateIPv4('172.16.0.1'), true));
    it('detects 169.254.x.x', () => assert.equal(isPrivateIPv4('169.254.1.1'), true));
    it('rejects public IPs', () => assert.equal(isPrivateIPv4('8.8.8.8'), false));
    it('rejects non-IPv4', () => assert.equal(isPrivateIPv4('not-an-ip'), false));
  });

  describe('isPrivateIPv6', () => {
    it('detects ::1', () => assert.equal(isPrivateIPv6('::1'), true));
    it('detects fe80: link-local', () => assert.equal(isPrivateIPv6('fe80::1'), true));
    it('detects fc unique-local', () => assert.equal(isPrivateIPv6('fc00::1'), true));
    it('detects fd unique-local', () => assert.equal(isPrivateIPv6('fd00::1'), true));
    it('rejects non-IPv6', () => assert.equal(isPrivateIPv6('not-an-ip'), false));
  });

  describe('RateLimiter', () => {
    it('allows requests within limit', () => {
      const limiter = new RateLimiter(5, 60000);
      const r = limiter.check('1.2.3.4');
      assert.equal(r.allowed, true);
      assert.equal(r.remaining, 4);
      limiter.destroy();
    });

    it('blocks requests exceeding limit', () => {
      const limiter = new RateLimiter(2, 60000);
      limiter.check('1.2.3.4');
      limiter.check('1.2.3.4');
      const r = limiter.check('1.2.3.4');
      assert.equal(r.allowed, false);
      assert.equal(r.remaining, 0);
      limiter.destroy();
    });

    it('tracks IPs independently', () => {
      const limiter = new RateLimiter(1, 60000);
      limiter.check('1.1.1.1');
      const r = limiter.check('2.2.2.2');
      assert.equal(r.allowed, true);
      limiter.destroy();
    });
  });
});

// ============================================================
// Unit tests for cache module
// ============================================================
const { LRUCache } = require('../src/cache');

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache(10, 60000);
    cache.set('key1', 'value1');
    assert.equal(cache.get('key1'), 'value1');
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache(10, 60000);
    assert.equal(cache.get('missing'), undefined);
  });

  it('evicts oldest entry when full', () => {
    const cache = new LRUCache(2, 60000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('b'), 2);
    assert.equal(cache.get('c'), 3);
  });

  it('respects TTL', async () => {
    const cache = new LRUCache(10, 50); // 50ms TTL
    cache.set('key', 'value');
    assert.equal(cache.get('key'), 'value');
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(cache.get('key'), undefined);
  });

  it('has() returns correct results', () => {
    const cache = new LRUCache(10, 60000);
    cache.set('k', 'v');
    assert.equal(cache.has('k'), true);
    assert.equal(cache.has('missing'), false);
  });

  it('reports correct size', () => {
    const cache = new LRUCache(10, 60000);
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.size, 2);
  });

  it('clear() removes all entries', () => {
    const cache = new LRUCache(10, 60000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.equal(cache.size, 0);
    assert.equal(cache.get('a'), undefined);
  });
});

// ============================================================
// Unit tests for render module
// ============================================================
const { renderNote, renderError, renderAbout } = require('../src/render');

describe('render', () => {
  describe('renderNote', () => {
    const sampleNote = {
      id: 'abc123',
      text: 'Hello, world!',
      cw: null,
      user: {
        name: 'Test User',
        username: 'testuser',
        avatarUrl: 'https://example.com/avatar.png',
      },
      files: [],
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    it('renders valid HTML', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('og:title'));
      assert.ok(html.includes('twitter:card'));
    });

    it('includes user info in OG tags', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(html.includes('Test User (@testuser)'));
    });

    it('includes note text', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(html.includes('Hello, world!'));
    });

    it('includes content warning when present', () => {
      const noteWithCw = { ...sampleNote, cw: 'Spoiler alert' };
      const html = renderNote(noteWithCw, 'example.com');
      assert.ok(html.includes('Content Warning'));
      assert.ok(html.includes('Spoiler alert'));
    });

    it('escapes XSS in note text', () => {
      const xssNote = { ...sampleNote, text: '<script>alert("xss")</script>' };
      const html = renderNote(xssNote, 'example.com');
      assert.ok(!html.includes('<script>alert'));
      assert.ok(html.includes('&lt;script&gt;'));
    });

    it('escapes XSS in user display name', () => {
      const xssNote = { ...sampleNote, user: { ...sampleNote.user, name: '<img onerror=alert(1)>' } };
      const html = renderNote(xssNote, 'example.com');
      assert.ok(!html.includes('<img onerror'));
    });

    it('includes image meta tags when image files present', () => {
      const noteWithImage = {
        ...sampleNote,
        files: [{ type: 'image/png', url: 'https://example.com/photo.png' }],
      };
      const html = renderNote(noteWithImage, 'example.com');
      assert.ok(html.includes('og:image'));
      assert.ok(html.includes('summary_large_image'));
    });

    it('includes video meta tags when video files present', () => {
      const noteWithVideo = {
        ...sampleNote,
        files: [{ type: 'video/mp4', url: 'https://example.com/video.mp4' }],
      };
      const html = renderNote(noteWithVideo, 'example.com');
      assert.ok(html.includes('og:video'));
      assert.ok(html.includes('player'));
    });

    it('handles notes with no user gracefully', () => {
      const noteNoUser = { ...sampleNote, user: null };
      const html = renderNote(noteNoUser, 'example.com');
      assert.ok(html.includes('Unknown'));
    });

    it('includes engagement stats when present', () => {
      const noteWithStats = {
        ...sampleNote,
        repliesCount: 5,
        renoteCount: 10,
        reactions: { '👍': 3, '❤️': 7 },
      };
      const html = renderNote(noteWithStats, 'example.com');
      assert.ok(html.includes('💬 5'));
      assert.ok(html.includes('🔁 10'));
      assert.ok(html.includes('⭐ 10'));
    });

    it('omits engagement stats when all zero', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(!html.includes('class="stats"'));
    });

    it('includes canonical link to original note', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(html.includes('<link rel="canonical"'));
      assert.ok(html.includes('https://example.com/notes/abc123'));
    });

    it('includes og:article:author meta tag', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(html.includes('og:article:author'));
      assert.ok(html.includes('Test User'));
    });

    it('includes multiple og:image tags for multiple images', () => {
      const noteWithImages = {
        ...sampleNote,
        files: [
          { type: 'image/png', url: 'https://example.com/photo1.png' },
          { type: 'image/jpeg', url: 'https://example.com/photo2.jpg' },
        ],
      };
      const html = renderNote(noteWithImages, 'example.com');
      const ogImageCount = (html.match(/og:image/g) || []).length;
      assert.equal(ogImageCount, 2);
    });
  });

  describe('renderError', () => {
    it('renders error page', () => {
      const html = renderError(404, 'Not found');
      assert.ok(html.includes('404'));
      assert.ok(html.includes('Not found'));
    });

    it('escapes HTML in error message', () => {
      const html = renderError(500, '<script>alert(1)</script>');
      assert.ok(!html.includes('<script>alert'));
    });
  });

  describe('renderAbout', () => {
    it('renders valid HTML', () => {
      const html = renderAbout();
      assert.ok(html.includes('<!DOCTYPE html>'));
      assert.ok(html.includes('vxsharkey'));
    });

    it('includes OG metadata', () => {
      const html = renderAbout();
      assert.ok(html.includes('og:title'));
      assert.ok(html.includes('og:description'));
    });

    it('includes usage instructions', () => {
      const html = renderAbout();
      assert.ok(html.includes('How it works'));
      assert.ok(html.includes('Usage'));
      assert.ok(html.includes('Features'));
    });

    it('includes theme-color', () => {
      const html = renderAbout();
      assert.ok(html.includes('theme-color'));
    });
  });

  describe('renderNote embed improvements', () => {
    const sampleNote = {
      id: 'abc123',
      text: 'Hello, world!',
      cw: null,
      user: {
        name: 'Test User',
        username: 'testuser',
        avatarUrl: 'https://example.com/avatar.png',
      },
      files: [],
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    it('includes oEmbed link tag', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(html.includes('application/json+oembed'));
    });

    it('includes author info in oEmbed data', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(html.includes('author_name'));
      assert.ok(html.includes('testuser'));
    });

    it('includes published time meta tag', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(html.includes('og:article:published_time'));
      assert.ok(html.includes('2024-01-01T00:00:00.000Z'));
    });

    it('omits published time when createdAt is missing', () => {
      const noteNoDate = { ...sampleNote, createdAt: null };
      const html = renderNote(noteNoDate, 'example.com');
      assert.ok(!html.includes('og:article:published_time'));
    });

    it('includes instance name in title', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(html.includes('on example.com'));
    });

    it('includes author_icon (avatar) in oEmbed data', () => {
      const html = renderNote(sampleNote, 'example.com');
      assert.ok(html.includes('author_icon'));
      assert.ok(html.includes('https://example.com/avatar.png'));
    });

    it('includes provider_name as vxsharkey with date in oEmbed data', () => {
      const html = renderNote(sampleNote, 'example.com');
      // Extract the oEmbed JSON from the data URI
      const match = html.match(/data:application\/json,([^"]+)/);
      assert.ok(match, 'oEmbed data URI should be present');
      const oEmbed = JSON.parse(decodeURIComponent(match[1]));
      assert.ok(oEmbed.provider_name.startsWith('vxsharkey'));
      assert.ok(oEmbed.provider_name.includes('2024-01-01'));
    });

    it('includes provider_name as vxsharkey without date when createdAt missing', () => {
      const noteNoDate = { ...sampleNote, createdAt: null };
      const html = renderNote(noteNoDate, 'example.com');
      const match = html.match(/data:application\/json,([^"]+)/);
      assert.ok(match, 'oEmbed data URI should be present');
      const oEmbed = JSON.parse(decodeURIComponent(match[1]));
      assert.equal(oEmbed.provider_name, 'vxsharkey');
    });

    it('includes provider_icon in oEmbed data', () => {
      const html = renderNote(sampleNote, 'example.com');
      const match = html.match(/data:application\/json,([^"]+)/);
      assert.ok(match, 'oEmbed data URI should be present');
      const oEmbed = JSON.parse(decodeURIComponent(match[1]));
      assert.ok(oEmbed.provider_icon);
    });

    it('includes provider_url pointing to vxsharkey repo', () => {
      const html = renderNote(sampleNote, 'example.com');
      const match = html.match(/data:application\/json,([^"]+)/);
      assert.ok(match, 'oEmbed data URI should be present');
      const oEmbed = JSON.parse(decodeURIComponent(match[1]));
      assert.equal(oEmbed.provider_url, 'https://github.com/m4rcel-lol/vxsharkey');
    });
  });
});

// ============================================================
// Integration tests for routes
// ============================================================
const fastify = require('fastify');
const { registerRoutes, isBot } = require('../src/routes');

describe('isBot', () => {
  it('detects Discord bot', () => {
    assert.equal(isBot('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'), true);
  });

  it('detects Slack bot', () => {
    assert.equal(isBot('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'), true);
  });

  it('detects Telegram bot', () => {
    assert.equal(isBot('TelegramBot (like TwitterBot)'), true);
  });

  it('detects Twitter bot', () => {
    assert.equal(isBot('Twitterbot/1.0'), true);
  });

  it('detects generic crawlers', () => {
    assert.equal(isBot('Googlebot/2.1'), true);
    assert.equal(isBot('curl/7.68.0'), true);
  });

  it('returns true for empty user-agent', () => {
    assert.equal(isBot(''), true);
  });

  it('returns true for missing user-agent', () => {
    assert.equal(isBot(undefined), true);
  });

  it('returns false for regular browser', () => {
    assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'), false);
  });

  it('returns false for mobile browser', () => {
    assert.equal(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'), false);
  });
});

describe('routes (integration)', () => {
  let app;
  let cache;
  let rateLimiter;

  before(async () => {
    cache = new LRUCache(100, 300000);
    rateLimiter = new RateLimiter(100, 60000);
    app = fastify({ logger: false });
    registerRoutes(app, { cache, rateLimiter });
    await app.ready();
  });

  after(async () => {
    rateLimiter.destroy();
    await app.close();
  });

  it('GET /health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
  });

  it('GET / returns about page', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.body.includes('vxsharkey'));
    assert.ok(res.body.includes('How it works'));
  });

  it('GET / includes cache headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    assert.ok(res.headers['cache-control'].includes('public'));
  });

  it('GET /metrics returns metrics', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok('cacheSize' in body);
    assert.ok('uptime' in body);
  });

  it('rejects invalid instance domain', async () => {
    const res = await app.inject({ method: 'GET', url: '/localhost/notes/abc123' });
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.includes('Invalid instance'));
  });

  it('rejects IP address as instance', async () => {
    const res = await app.inject({ method: 'GET', url: '/192.168.1.1/notes/abc123' });
    assert.equal(res.statusCode, 400);
  });

  it('rejects invalid note ID', async () => {
    const res = await app.inject({ method: 'GET', url: '/example.com/notes/../../etc' });
    // Fastify will handle the path traversal, but our validation should also catch it
    assert.ok(res.statusCode === 400 || res.statusCode === 404);
  });

  it('rejects note ID with special chars', async () => {
    const res = await app.inject({ method: 'GET', url: '/example.com/notes/abc-def' });
    assert.equal(res.statusCode, 400);
    assert.ok(res.body.includes('Invalid note ID'));
  });

  it('returns 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/some/random/path' });
    assert.equal(res.statusCode, 404);
  });

  it('redirects regular browsers to original note URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/example.com/notes/abc123',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, 'https://example.com/notes/abc123');
  });

  it('serves embed page for bot user-agents', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/example.com/notes/abc123',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
      },
    });
    // Will be 502 because example.com isn't reachable, but the important thing
    // is that it does NOT redirect (not 302)
    assert.notEqual(res.statusCode, 302);
  });
});
