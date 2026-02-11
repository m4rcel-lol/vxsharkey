'use strict';

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str - Raw string to escape
 * @returns {string} Escaped string safe for HTML embedding
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Sanitize a URL for safe embedding in HTML attributes.
 * Only allows http: and https: protocols.
 * @param {string} url - Raw URL
 * @returns {string} Sanitized URL or empty string
 */
function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  return '';
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed.
 * @param {string} text - Input text
 * @param {number} max - Maximum length
 * @returns {string} Truncated text
 */
function truncate(text, max = 300) {
  if (typeof text !== 'string') return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

module.exports = { escapeHtml, sanitizeUrl, truncate };
