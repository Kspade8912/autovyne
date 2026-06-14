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

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error) {
  const message = String(error?.message || '');
  return (
    message.includes('HTTP 408') ||
    message.includes('HTTP 409') ||
    message.includes('HTTP 425') ||
    message.includes('HTTP 429') ||
    message.includes('HTTP 500') ||
    message.includes('HTTP 502') ||
    message.includes('HTTP 503') ||
    message.includes('HTTP 504') ||
    message.includes('aborted') ||
    message.includes('The operation was aborted')
  );
}

async function fetchJsonWithRetry(url, options = {}, timeoutMs = 10000, retryOptions = {}) {
  const retries = Number.isInteger(retryOptions.retries) ? retryOptions.retries : 2;
  const baseDelayMs = Number.isInteger(retryOptions.baseDelayMs) ? retryOptions.baseDelayMs : 350;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJson(url, options, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableError(error)) throw error;
      await wait(baseDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}

module.exports = { fetchJson, fetchJsonWithRetry, isRetryableError };
