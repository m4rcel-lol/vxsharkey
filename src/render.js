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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${ogTitle}</title>
<meta property="og:site_name" content="vxsharkey" />
<meta property="og:title" content="${ogTitle}" />
<meta property="og:description" content="${ogDescription}" />
<meta property="og:url" content="${noteUrl}" />
<meta property="og:type" content="article" />
<meta property="og:article:author" content="${displayName}" />
${ogImageTags}${firstVideo ? `<meta property="og:video" content="${firstVideo}" />\n<meta property="og:video:type" content="video/mp4" />\n` : ''}<meta name="twitter:card" content="${twitterCard}" />
<meta name="twitter:title" content="${ogTitle}" />
<meta name="twitter:description" content="${ogDescription}" />
${firstImage ? `<meta name="twitter:image" content="${firstImage}" />\n` : ''}${firstVideo ? `<meta name="twitter:player" content="${firstVideo}" />\n` : ''}<meta name="theme-color" content="#86b300" />
<link rel="canonical" href="${noteUrl}" />
<link rel="alternate" type="application/json+oembed" href="${noteUrl}" />
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

module.exports = { renderNote, renderError };
