/**
 * Self-hosted analytics — no external scripts, no cookies, no GDPR complexity.
 * Fires beacons for: page views, form submissions, CTA clicks, demo slider interactions.
 */
(function () {
  var endpoint = '/api/analytics';
  var page = window.location.pathname;
  var referrer = document.referrer || null;
  var sessionId = null;

  // ── helpers ───────────────────────────────────────────────────────────────

  // Deterministic session ID for this browser tab (random once per session)
  function getSessionId() {
    if (sessionId) return sessionId;
    sessionId = localStorage.getItem('av_sid');
    if (!sessionId) {
      sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
      localStorage.setItem('av_sid', sessionId);
    }
    return sessionId;
  }

  function beacon(eventType, metadata) {
    var payload = JSON.stringify({
      page: page,
      event_type: eventType,
      metadata: metadata || {},
      referrer: referrer,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, payload);
    } else {
      // Fallback for older browsers
      var xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload);
    }
  }

  // ── page view (on load) ────────────────────────────────────────────────────
  beacon('view', {
    sessionId: getSessionId(),
    url: window.location.href,
  });

  // ── CTA clicks (Get Started / pricing buttons) ─────────────────────────────
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track="cta"], .btn-primary, .btn-cta, .cta-btn');
    if (!el) return;
    var label = el.textContent.trim().replace(/\n/g, ' ').slice(0, 100) || el.className;
    beacon('click', {
      label: label,
      href: el.href || null,
      sessionId: getSessionId(),
    });
  });

  // ── form submissions ───────────────────────────────────────────────────────
  // Intercept form submissions on the intake page
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function () {
      // Small delay to let the form handler fire first
      setTimeout(function () {
        beacon('submit', {
          formId: form.id || 'unknown',
          page: page,
          sessionId: getSessionId(),
        });
      }, 50);
    });
  });

  // Also intercept the /api/leads fetch submissions (JSON forms)
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.method && form.method.toLowerCase() === 'post' && form.action && form.action.includes('/api/leads')) {
      setTimeout(function () {
        beacon('submit', {
          formId: 'api-leads',
          page: page,
          sessionId: getSessionId(),
        });
      }, 50);
    }
  });

  // ── demo slider interactions (aggregate count, not per-event) ──────────────
  var sliderCount = 0;
  document.querySelectorAll('input[type="range"]').forEach(function (slider) {
    slider.addEventListener('input', function () {
      sliderCount++;
      // Debounce: fire every 5th interaction to avoid flooding
      if (sliderCount % 5 === 0) {
        beacon('demo_interaction', {
          sessionId: getSessionId(),
          interactionCount: sliderCount,
        });
      }
    });
  });
})();