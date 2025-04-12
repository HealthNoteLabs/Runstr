/**
 * WebSocket polyfill for Node.js environment
 * Uses the 'ws' package to provide WebSocket functionality
 */

// This assumes the ws package is installed (npm install ws)
const WebSocket = require('ws');

// Add additional WebSocket properties to match browser behavior
if (!WebSocket.CONNECTING) WebSocket.CONNECTING = 0;
if (!WebSocket.OPEN) WebSocket.OPEN = 1;
if (!WebSocket.CLOSING) WebSocket.CLOSING = 2;
if (!WebSocket.CLOSED) WebSocket.CLOSED = 3;

// Add to global scope if it doesn't exist
if (typeof global !== 'undefined' && !global.WebSocket) {
  global.WebSocket = WebSocket;
} else if (typeof window !== 'undefined' && !window.WebSocket) {
  window.WebSocket = WebSocket;
}

module.exports = WebSocket; 