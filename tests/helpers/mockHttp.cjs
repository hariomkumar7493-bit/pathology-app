'use strict';

/**
 * Shared in-memory HTTP mock response store used by sync.test.cjs
 *
 * Keys: "<METHOD> <hostname><path>"
 * Values: { status: number, data: any }
 */

const store = {};

function set(key, response) {
  store[key] = response;
}

function get(method, hostname, path) {
  const key = `${method} ${hostname}${path}`;
  return store[key] || store['*'] || null;
}

function reset() {
  for (const k of Object.keys(store)) delete store[k];
}

// Export both the store and helpers so the https mock can use them
module.exports = { store, mockResponses: store, set, get, reset };
