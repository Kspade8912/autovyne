async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch (_error) {
        body = text;
      }
    }

    if (!response.ok) {
      const detail = typeof body === 'string' ? body : JSON.stringify(body || {});
      throw new Error(`HTTP ${response.status}: ${detail.slice(0, 500)}`);
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchJson };
