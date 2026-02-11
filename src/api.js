'use strict';

/** Maximum response body size: 1 MB */
const MAX_RESPONSE_SIZE = 1024 * 1024;

/** Upstream request timeout: 5 seconds */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Fetch a public note from a Sharkey/Misskey instance.
 *
 * @param {string} instance - The instance domain (e.g. "sharkey.example.com")
 * @param {string} noteId - The note ID
 * @returns {Promise<{ ok: boolean, status: number, note?: object, error?: string }>}
 */
async function fetchNote(instance, noteId) {
  const url = `https://${instance}/api/notes/show`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'vxsharkey/1.0' },
      body: JSON.stringify({ noteId }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { ok: false, status: 504, error: 'Upstream request timed out' };
    }
    return { ok: false, status: 502, error: `Upstream request failed: ${err.message}` };
  }

  if (!response.ok) {
    if (response.status === 404) {
      return { ok: false, status: 404, error: 'Note not found' };
    }
    return { ok: false, status: 502, error: `Upstream returned ${response.status}` };
  }

  // Read body with size cap
  let body;
  try {
    const text = await readResponseWithLimit(response, MAX_RESPONSE_SIZE);
    body = JSON.parse(text);
  } catch (err) {
    return { ok: false, status: 502, error: `Failed to parse upstream response: ${err.message}` };
  }

  // Validate the note is public
  if (body.visibility && body.visibility !== 'public') {
    return { ok: false, status: 404, error: 'Note is not public' };
  }

  return { ok: true, status: 200, note: body };
}

/**
 * Read a fetch Response body with a maximum size limit.
 * @param {Response} response
 * @param {number} maxBytes
 * @returns {Promise<string>}
 */
async function readResponseWithLimit(response, maxBytes) {
  const reader = response.body.getReader();
  const chunks = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalSize += value.length;
    if (totalSize > maxBytes) {
      reader.cancel();
      throw new Error('Response body exceeds maximum size');
    }
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  return chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
}

module.exports = { fetchNote, MAX_RESPONSE_SIZE, REQUEST_TIMEOUT_MS };
