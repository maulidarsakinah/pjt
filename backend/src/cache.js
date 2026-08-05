const logger = require("./logger");

class TtlCache {
  constructor({ name, ttlMs, maxItems }) {
    this.name = name;
    this.ttlMs = ttlMs;
    this.maxItems = maxItems;
    this.items = new Map();
  }

  get(key) {
    const entry = this.items.get(key);

    if (!entry) {
      logger.debug({ cache: this.name, key, status: "miss" }, "cache_miss");
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.items.delete(key);
      logger.debug(
        { cache: this.name, key, status: "expired" },
        "cache_expired",
      );
      return undefined;
    }

    this.items.delete(key);
    this.items.set(key, entry);
    logger.debug({ cache: this.name, key, status: "hit" }, "cache_hit");
    return entry.value;
  }

  set(key, value) {
    if (this.items.has(key)) {
      this.items.delete(key);
    }

    this.items.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });

    this.evictOverflow();
  }

  delete(key) {
    return this.items.delete(key);
  }

  clear() {
    this.items.clear();
  }

  evictOverflow() {
    while (this.items.size > this.maxItems) {
      const oldestKey = this.items.keys().next().value;
      this.items.delete(oldestKey);
      logger.debug(
        { cache: this.name, key: oldestKey, status: "evicted" },
        "cache_evicted",
      );
    }
  }
}

module.exports = {
  TtlCache,
};
