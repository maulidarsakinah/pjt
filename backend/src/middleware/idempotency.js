const { TtlCache } = require("../cache");
const config = require("../config");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

const store = new TtlCache({
  name: "idempotency",
  ttlMs: config.idempotency.ttlMs,
  maxItems: config.idempotency.maxItems,
});

// key -> Promise<{status, body, headers, isJson}>
const inflight = new Map();

function scopeKey(req, rawKey) {
  const actor = req.user
    ? `u:${req.user.id}`
    : `ip:${req.ip || req.socket?.remoteAddress || "anon"}`;
  const route = `${req.method}:${(req.originalUrl || req.url || "").split("?")[0]}`;
  return `${actor}:${route}:${rawKey}`;
}

function validateKey(raw) {
  if (typeof raw !== "string" || !KEY_RE.test(raw)) {
    const err = new Error(
      "Idempotency-Key must be 8-128 chars matching [A-Za-z0-9_-] (e.g. UUID v4)"
    );
    err.statusCode = 400;
    err.publicMessage = err.message;
    err.publicCode = "INVALID_IDEMPOTENCY_KEY";
    throw err;
  }
}

function replay(res, entry) {
  res.setHeader("Idempotent-Replayed", "true");
  if (entry.headers) {
    for (const [k, v] of Object.entries(entry.headers)) {
      try {
        res.setHeader(k, v);
      } catch (_) {}
    }
  }
  if (entry.isJson === false) {
    return res.status(entry.status).send(entry.body);
  }
  return res.status(entry.status).json(entry.body);
}

/**
 * Optional idempotency middleware (no DB).
 * - If Idempotency-Key header is absent: passthrough (no 400).
 * - If present but malformed: 400 INVALID_IDEMPOTENCY_KEY.
 * - If present and valid:
 *   - scoped by user (or IP for unauth) + method+path + key
 *   - replays stored 2xx response with Idempotent-Replayed: true
 *   - coalesces concurrent duplicates via inflight promise map (race-safe)
 *   - only caches 2xx; errors are not cached so client can fix and retry
 */
function idempotency() {
  return async (req, res, next) => {
    if (!MUTATING_METHODS.has(req.method)) return next();

    const rawKey = req.headers["idempotency-key"];
    if (!rawKey) return next();

    try {
      validateKey(rawKey);
    } catch (e) {
      return next(e);
    }

    const key = scopeKey(req, rawKey);

    const cached = store.get(key);
    if (cached) {
      req.idempotentReplayed = true;
      return replay(res, cached);
    }

    if (inflight.has(key)) {
      try {
        const result = await inflight.get(key);
        req.idempotentReplayed = true;
        return replay(res, result);
      } catch (_) {
        // First attempt failed — allow this retry to execute handler fresh
        // and become the new owner. Remove stale inflight if still present.
        inflight.delete(key);
      }
    }

    // Become owner
    let resolveInflight;
    let rejectInflight;
    const promise = new Promise((resolve, reject) => {
      resolveInflight = resolve;
      rejectInflight = reject;
    });
    promise.catch(() => {});
    inflight.set(key, promise);

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalStatus = res.status.bind(res);
    let statusCode = res.statusCode || 200;
    let captured = false;

    function captureSuccess(status, body, isJson) {
      if (captured) return;
      captured = true;
      const headersToReplay = {};
      const setCookie = res.getHeader("Set-Cookie");
      if (setCookie) headersToReplay["Set-Cookie"] = setCookie;
      const entry = { status, body, headers: headersToReplay, isJson };
      store.set(key, entry);
      resolveInflight(entry);
      setTimeout(() => inflight.delete(key), 60);
    }

    function captureError(err) {
      if (captured) return;
      captured = true;
      try {
        rejectInflight(err);
      } catch (_) {}
      inflight.delete(key);
    }

    res.status = (code) => {
      statusCode = code;
      return originalStatus(code);
    };

    res.json = (body) => {
      const status = statusCode;
      if (status >= 200 && status < 300) captureSuccess(status, body, true);
      else captureError(Object.assign(new Error("idempotency not cached for error response"), { statusCode: status, body }));
      return originalJson(body);
    };

    res.send = (body) => {
      if (captured) return originalSend(body);
      const status = statusCode;
      if (status >= 200 && status < 300) {
        const entryBody = body === undefined ? null : body;
        captureSuccess(status, entryBody, false);
      } else {
        captureError(Object.assign(new Error("not cached"), { statusCode: status, body }));
      }
      return originalSend(body);
    };

    // Safety net: if handler never calls res.json/send (e.g. errorHandler
    // not yet invoked, or streaming), clean inflight on finish/close.
    const cleanup = () => {
      if (!captured) {
        try {
          rejectInflight(new Error("response finished without json/send"));
        } catch (_) {}
        inflight.delete(key);
      }
    };
    res.once("finish", cleanup);
    res.once("close", cleanup);

    req.idempotencyKey = rawKey;
    req.idempotencyScopeKey = key;
    return next();
  };
}

module.exports = { idempotency, _store: store, _inflight: inflight };
