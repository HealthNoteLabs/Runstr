import { SimplePool } from 'nostr-tools';
import { Buffer as BufferPolyfill } from 'buffer';
import 'fast-text-encoding';
import { Crypto as WebCrypto } from '@peculiar/webcrypto';

// ----- Additional polyfills for Android WebView -----
// Some libraries expect globals that WebView may not have (Buffer, TextEncoder/Decoder)
if (typeof window !== 'undefined') {
  if (!window.Buffer) {
    window.Buffer = BufferPolyfill;
     
    console.info('[nostr-polyfill] Buffer shim applied');
  }
  if (typeof window.TextEncoder === 'undefined' || typeof window.TextDecoder === 'undefined') {
    // text-encoding-polyfill adds these globally
     
    console.info('[nostr-polyfill] TextEncoder/TextDecoder shim applied');
  }
  if (!window.crypto) {
    window.crypto = {};
  }
  if (!window.crypto.subtle) {
    window.crypto.subtle = new WebCrypto().subtle;
     
    console.info('[nostr-polyfill] WebCrypto.subtle shim applied');
  }
}

// Polyfill `SimplePool.list` for nostr-tools v2 where the helper was removed.
// The shim opens a temporary subscription with `closeOnEose` semantics and
// resolves once EOSE is received or the optional timeout is reached.
if (SimplePool && typeof SimplePool.prototype.list !== 'function') {
   
  SimplePool.prototype.list = async function list(relays, filters, opts = {}) {
    const { timeout = 10000 } = opts;

    return new Promise((resolve) => {
      const collected = [];

      const sub = this.subscribe(
        relays,
        filters,
        {
          onevent(evt) {
            collected.push(evt);
          },
          oneose() {
            try {
              sub.close();
            } catch {
              // ignore
            }
            resolve(collected);
          },
        },
      );

      // Fallback safety timeout
      if (timeout > 0) {
        setTimeout(() => {
          try {
            sub.close();
          } catch {
            // ignore
          }
          resolve(collected);
        }, timeout);
      }
    });
  };

   
  console.info('[nostr-polyfill] SimplePool.list shim applied');
} 