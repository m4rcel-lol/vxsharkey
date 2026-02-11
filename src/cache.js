'use strict';

/**
 * Simple LRU cache with TTL support.
 */
class LRUCache {
  /**
   * @param {number} maxSize - Maximum number of entries
   * @param {number} ttlMs - Time-to-live in milliseconds
   */
  constructor(maxSize = 500, ttlMs = 300000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this.store = new Map();
  }

  /**
   * Get a cached value. Returns undefined if not found or expired.
   * @param {string} key
   * @returns {any|undefined}
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  /**
   * Set a cached value.
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    // Delete first to re-insert at end
    this.store.delete(key);

    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Check if key exists and is not expired.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /** Get the number of (possibly expired) entries. */
  get size() {
    return this.store.size;
  }

  /** Clear all entries. */
  clear() {
    this.store.clear();
  }
}

module.exports = { LRUCache };
