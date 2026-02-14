'use strict';

const { escapeHtml, sanitizeUrl, truncate } = require('./sanitize');

/**
 * Render a note as an HTML page with OG/Twitter Card metadata.
 *
 * @param {object} note - The Misskey/Sharkey note object
 * @param {string} instance - The instance domain
 * @returns {string} Complete HTML page
 */
function renderNote(note, instance) {
  const user = note.user || {};
  const displayName = escapeHtml(user.name || user.username || 'Unknown');
  const username = escapeHtml(user.username || 'unknown');
  const avatarUrl = sanitizeUrl(user.avatarUrl || '');
  const noteUrl = `https://${escapeHtml(instance)}/notes/${escapeHtml(note.id || '')}`;

  const cw = note.cw ? escapeHtml(note.cw) : '';
  const text = escapeHtml(note.text || '');
  const createdAt = note.createdAt ? escapeHtml(note.createdAt) : '';

  // Engagement metrics
  const repliesCount = typeof note.repliesCount === 'number' ? note.repliesCount : 0;
  const renoteCount = typeof note.renoteCount === 'number' ? note.renoteCount : 0;
  const reactionCount = note.reactions ? Object.values(note.reactions).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0) : 0;

  // Build description for OG tags with engagement stats
  let description = '';
  if (cw) {
    description = `⚠️ CW: ${truncate(note.cw, 200)}\n\n${truncate(note.text || '', 200)}`;
  } else {
    description = truncate(note.text || '', 300);
  }

  // Append engagement stats to description
  const stats = [];
  if (repliesCount > 0) stats.push(`💬 ${repliesCount}`);
  if (renoteCount > 0) stats.push(`🔁 ${renoteCount}`);
  if (reactionCount > 0) stats.push(`⭐ ${reactionCount}`);
  if (stats.length > 0) {
    description += `\n\n${stats.join('  ')}`;
  }

  const ogDescription = escapeHtml(description);

  const ogTitle = `${displayName} (@${username})`;

  // Extract media
  const files = Array.isArray(note.files) ? note.files : [];
  const images = files.filter((f) => f.type && f.type.startsWith('image/'));
  const videos = files.filter((f) => f.type && f.type.startsWith('video/'));

  const firstImage = images.length > 0 ? sanitizeUrl(images[0].url || images[0].thumbnailUrl) : '';
  const firstVideo = videos.length > 0 ? sanitizeUrl(videos[0].url) : '';

  // Twitter card type
  let twitterCard = 'summary';
  if (firstVideo) {
    twitterCard = 'player';
  } else if (firstImage) {
    twitterCard = 'summary_large_image';
  }

  // Build media HTML for body
  let mediaHtml = '';
  for (const img of images) {
    const imgUrl = sanitizeUrl(img.url || img.thumbnailUrl || '');
    if (imgUrl) {
      mediaHtml += `<div class="media"><img src="${imgUrl}" alt="Attached image" loading="lazy" /></div>\n`;
    }
  }
  for (const vid of videos) {
    const vidUrl = sanitizeUrl(vid.url || '');
    const thumbUrl = sanitizeUrl(vid.thumbnailUrl || '');
    if (vidUrl) {
      mediaHtml += `<div class="media"><video controls preload="metadata"${thumbUrl ? ` poster="${thumbUrl}"` : ''}><source src="${vidUrl}" type="${escapeHtml(vid.type || 'video/mp4')}" />Your browser does not support video.</video></div>\n`;
    }
  }

  // Build OG image tags for multiple images
  let ogImageTags = '';
  for (const img of images) {
    const imgUrl = sanitizeUrl(img.url || img.thumbnailUrl || '');
    if (imgUrl) {
      ogImageTags += `<meta property="og:image" content="${imgUrl}" />\n`;
    }
  }

  // CW HTML
  const cwHtml = cw
    ? `<div class="cw"><strong>⚠️ Content Warning:</strong> ${cw}</div>`
    : '';

  // Note text with line breaks
  const noteTextHtml = text.replace(/\n/g, '<br />');

  // Engagement stats HTML
  let statsHtml = '';
  if (repliesCount > 0 || renoteCount > 0 || reactionCount > 0) {
    statsHtml = '<div class="stats">';
    if (repliesCount > 0) statsHtml += `<span class="stat">💬 ${repliesCount}</span>`;
    if (renoteCount > 0) statsHtml += `<span class="stat">🔁 ${renoteCount}</span>`;
    if (reactionCount > 0) statsHtml += `<span class="stat">⭐ ${reactionCount}</span>`;
    statsHtml += '</div>';
  }

  // Format date for display in embed footer
  let formattedDate = '';
  if (createdAt) {
    try {
      const d = new Date(note.createdAt);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
          ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
    } catch {
      // keep formattedDate empty on parse failure
    }
  }

  // oEmbed JSON for richer Discord/Slack embeds
  const oEmbedAuthorName = `${user.name || user.username || 'Unknown'} (@${user.username || 'unknown'}@${instance})`;
  const oEmbedObj = {
    version: '1.0',
    type: 'link',
    author_name: oEmbedAuthorName,
    author_url: `https://${instance}/@${user.username || 'unknown'}`,
    provider_name: formattedDate ? `vxsharkey · ${formattedDate}` : 'vxsharkey',
    provider_url: 'https://github.com/m4rcel-lol/vxsharkey',
  };
  // Use thumbnail_url (standard oEmbed field) for author avatar when no images
  if (avatarUrl && images.length === 0) {
    oEmbedObj.thumbnail_url = avatarUrl;
    oEmbedObj.thumbnail_width = 48;
    oEmbedObj.thumbnail_height = 48;
  }
  const oEmbedData = JSON.stringify(oEmbedObj);

  // Build conditional meta tags
  let publishedTimeMeta = '';
  if (createdAt) {
    publishedTimeMeta = `<meta property="og:article:published_time" content="${createdAt}" />\n`;
  }

  let videoMetaTags = '';
  if (firstVideo) {
    videoMetaTags = `<meta property="og:video" content="${firstVideo}" />\n<meta property="og:video:type" content="video/mp4" />\n`;
  }

  let twitterImageMeta = '';
  if (firstImage) {
    twitterImageMeta = `<meta name="twitter:image" content="${firstImage}" />\n`;
  }

  let twitterPlayerMeta = '';
  if (firstVideo) {
    twitterPlayerMeta = `<meta name="twitter:player" content="${firstVideo}" />\n`;
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${ogTitle} on ${escapeHtml(instance)}</title>
<meta property="og:site_name" content="vxsharkey · ${escapeHtml(instance)}" />
<meta property="og:title" content="${ogTitle}" />
<meta property="og:description" content="${ogDescription}" />
<meta property="og:url" content="${noteUrl}" />
<meta property="og:type" content="article" />
<meta property="og:article:author" content="${displayName}" />
${publishedTimeMeta}${ogImageTags}${videoMetaTags}<meta name="twitter:card" content="${twitterCard}" />
<meta name="twitter:title" content="${ogTitle}" />
<meta name="twitter:description" content="${ogDescription}" />
${twitterImageMeta}${twitterPlayerMeta}<meta name="theme-color" content="#86b300" />
<link rel="alternate" type="application/json+oembed" href="data:application/json,${encodeURIComponent(oEmbedData)}" />
<link rel="canonical" href="${noteUrl}" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1a1a2e;color:#e0e0e0;padding:20px;max-width:600px;margin:0 auto}
.card{background:#16213e;border-radius:12px;padding:20px;margin-top:20px;box-shadow:0 2px 10px rgba(0,0,0,0.3)}
.header{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.avatar{width:48px;height:48px;border-radius:50%;object-fit:cover}
.user-info .name{font-weight:bold;font-size:1.1em}
.user-info .handle{color:#888;font-size:0.9em}
.cw{background:#2a1a1a;border:1px solid #8b4513;border-radius:8px;padding:10px;margin-bottom:12px;color:#ffaa44}
.text{line-height:1.6;white-space:pre-wrap;word-wrap:break-word}
.media{margin-top:12px}
.media img,.media video{max-width:100%;border-radius:8px}
.stats{margin-top:12px;display:flex;gap:16px;color:#888;font-size:0.9em}
.stat{display:inline-flex;align-items:center;gap:4px}
.meta{margin-top:16px;font-size:0.8em;color:#666}
.meta a{color:#86b300;text-decoration:none}
.meta a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="card">
<div class="header">
${avatarUrl ? `<img class="avatar" src="${avatarUrl}" alt="Avatar" />` : ''}
<div class="user-info">
<div class="name">${displayName}</div>
<div class="handle">@${username}@${escapeHtml(instance)}</div>
</div>
</div>
${cwHtml}
<div class="text">${noteTextHtml}</div>
${mediaHtml}
${statsHtml}
<div class="meta">
${createdAt ? `<time>${createdAt}</time> · ` : ''}<a href="${noteUrl}">View original note</a>
</div>
</div>
</body>
</html>`;
}

/**
 * Render a simple error HTML page.
 * @param {number} statusCode
 * @param {string} message
 * @returns {string}
 */
function renderError(statusCode, message) {
  const safeMessage = escapeHtml(message);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Error ${statusCode} - vxsharkey</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1a1a2e;color:#e0e0e0;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
.error{text-align:center;padding:40px}
.error h1{font-size:3em;color:#ff6b6b;margin-bottom:10px}
.error p{color:#888;font-size:1.1em}
</style>
</head>
<body>
<div class="error">
<h1>${statusCode}</h1>
<p>${safeMessage}</p>
</div>
</body>
</html>`;
}

/**
 * Render the about / landing page.
 * @returns {string} Complete HTML page
 */
function renderAbout() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>vxsharkey — Embed-optimized proxy for Sharkey &amp; Misskey</title>
<meta property="og:site_name" content="vxsharkey" />
<meta property="og:title" content="vxsharkey" />
<meta property="og:description" content="Embed-optimized proxy for public Sharkey/Misskey notes. Rich previews for Discord, Slack, Telegram &amp; more." />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="vxsharkey" />
<meta name="twitter:description" content="Embed-optimized proxy for public Sharkey/Misskey notes. Rich previews for Discord, Slack, Telegram &amp; more." />
<meta name="theme-color" content="#86b300" />
<meta name="description" content="Embed-optimized proxy for public Sharkey/Misskey notes. Rich previews for Discord, Slack, Telegram &amp; more." />
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1a1a2e;color:#e0e0e0;padding:20px;max-width:700px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;justify-content:center}
h1{font-size:2.2em;margin-bottom:8px;color:#86b300}
.subtitle{color:#888;font-size:1.1em;margin-bottom:32px}
.card{background:#16213e;border-radius:12px;padding:24px;margin-bottom:20px;box-shadow:0 2px 10px rgba(0,0,0,0.3)}
.card h2{font-size:1.2em;margin-bottom:12px;color:#86b300}
.card p,.card li{line-height:1.7;color:#ccc}
.card ul{padding-left:20px;margin-top:8px}
.card li{margin-bottom:4px}
code{background:#0d1117;padding:3px 8px;border-radius:4px;font-size:0.95em;color:#86b300;word-break:break-all}
.footer{margin-top:32px;text-align:center;font-size:0.85em;color:#666}
.footer a{color:#86b300;text-decoration:none}
.footer a:hover{text-decoration:underline}
</style>
</head>
<body>
<div>
<h1>🦈 vxsharkey</h1>
<p class="subtitle">Embed-optimized proxy for public <a href="https://joinsharkey.org/" style="color:#86b300;text-decoration:none">Sharkey</a> / <a href="https://misskey-hub.net/" style="color:#86b300;text-decoration:none">Misskey</a> notes</p>
<div class="card">
<h2>How it works</h2>
<p>Replace the domain in a Sharkey or Misskey note URL with your vxsharkey instance, and platforms like Discord, Slack, and Telegram will display a rich embed with the note content, images, and videos.</p>
</div>
<div class="card">
<h2>Usage</h2>
<p>Simply format your URL like this:</p>
<p style="margin-top:12px"><code>https://your-vxsharkey-instance/{instance}/notes/{noteId}</code></p>
</div>
<div class="card">
<h2>Features</h2>
<ul>
<li>Rich OpenGraph &amp; Twitter Card metadata</li>
<li>Image and video preview support</li>
<li>Content Warning (CW) display</li>
<li>Engagement stats (replies, renotes, reactions)</li>
<li>Automatic redirect for regular browsers</li>
<li>Fast in-memory caching</li>
</ul>
</div>
<div class="footer">
<p>Powered by <a href="https://github.com/m4rcel-lol/vxsharkey">vxsharkey</a> · MIT License</p>
</div>
</div>
</body>
</html>`;
}

module.exports = { renderNote, renderError, renderAbout };
