'use strict';

const net = require('node:net');

/**
 * Regex for a valid hostname (no IP literals, no localhost).
 * Allows subdomains, requires TLD of at least 2 chars.
 */
const VALID_HOSTNAME_RE = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/;

/**
 * Check if an IPv4 address is in a private/reserved range.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIPv4(ip) {
  if (!net.isIPv4(ip)) return false;
  const parts = ip.split('.').map(Number);
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 0) return true;
  return false;
}

/**
 * Check if an IPv6 address is private/loopback.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIPv6(ip) {
  if (!net.isIPv6(ip)) return false;
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized === '::') return true;
  return false;
}

/**
 * Validate that an instance domain is safe to connect to.
 * Prevents SSRF by rejecting IPs, localhost, and private ranges.
 * @param {string} domain
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateInstanceDomain(domain) {
  if (typeof domain !== 'string' || domain.length === 0) {
    return { valid: false, reason: 'Empty domain' };
  }

  const lower = domain.toLowerCase().trim();

  if (lower === 'localhost' || lower.endsWith('.localhost')) {
    return { valid: false, reason: 'Localhost not allowed' };
  }

  if (net.isIPv4(lower) || net.isIPv6(lower)) {
    return { valid: false, reason: 'IP addresses not allowed' };
  }

  // Reject bracketed IPv6
  if (lower.startsWith('[') && lower.endsWith(']')) {
    return { valid: false, reason: 'IP addresses not allowed' };
  }

  if (!VALID_HOSTNAME_RE.test(lower)) {
    return { valid: false, reason: 'Invalid hostname format' };
  }

  // Additional check: reject domains that could resolve to private IPs
  // (DNS resolution is handled at fetch time; we only do syntactic validation here)
  return { valid: true };
}

/**
 * Validate a note ID (alphanumeric, reasonable length).
 * @param {string} noteId
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateNoteId(noteId) {
  if (typeof noteId !== 'string' || noteId.length === 0) {
    return { valid: false, reason: 'Empty note ID' };
  }
  if (noteId.length > 64) {
    return { valid: false, reason: 'Note ID too long' };
  }
  if (!/^[a-zA-Z0-9]+$/.test(noteId)) {
    return { valid: false, reason: 'Invalid note ID format' };
  }
  return { valid: true };
}

/**
 * Simple in-memory rate limiter using a sliding window.
 */
class RateLimiter {
  /**
   * @param {number} maxRequests - Max requests per window
   * @param {number} windowMs - Window duration in milliseconds
   */
  constructor(maxRequests = 60, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    /** @type {Map<string, number[]>} */
    this.clients = new Map();
    // Periodic cleanup every 2 minutes
    this._cleanupInterval = setInterval(() => this._cleanup(), 120000);
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref();
    }
  }

  /**
   * Check if a client IP is rate limited.
   * @param {string} ip
   * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
   */
  check(ip) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.clients.get(ip);
    if (!timestamps) {
      timestamps = [];
      this.clients.set(ip, timestamps);
    }

    // Remove expired timestamps
    while (timestamps.length > 0 && timestamps[0] <= windowStart) {
      timestamps.shift();
    }

    const remaining = Math.max(0, this.maxRequests - timestamps.length);
    const resetMs = timestamps.length > 0
      ? timestamps[0] + this.windowMs - now
      : this.windowMs;

    if (timestamps.length >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetMs };
    }

    timestamps.push(now);
    return { allowed: true, remaining: remaining - 1, resetMs };
  }

  /** Remove expired entries. */
  _cleanup() {
    const cutoff = Date.now() - this.windowMs;
    for (const [ip, timestamps] of this.clients) {
      while (timestamps.length > 0 && timestamps[0] <= cutoff) {
        timestamps.shift();
      }
      if (timestamps.length === 0) {
        this.clients.delete(ip);
      }
    }
  }

  /** Stop the cleanup interval. */
  destroy() {
    clearInterval(this._cleanupInterval);
  }
}

module.exports = {
  validateInstanceDomain,
  validateNoteId,
  isPrivateIPv4,
  isPrivateIPv6,
  RateLimiter,
};
