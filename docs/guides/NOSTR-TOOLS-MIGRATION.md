# Migration from NDK to nostr-tools

This document outlines the migration of the RUNSTR application from using the Nostr Development Kit (NDK) to the more lightweight [nostr-tools](https://github.com/nbd-wtf/nostr-tools) library.

## Overview of Changes

The codebase has been refactored to replace all NDK functionality with equivalent nostr-tools implementations:

1. Created a new `nostr.js` utility module that provides a consistent API using nostr-tools
2. Updated the `useRunFeed` hook to fetch and subscribe to events using nostr-tools
3. Modified the `usePostInteractions` hook to publish events with nostr-tools
4. Updated the package.json to remove NDK dependency and use nostr-tools

## Key Concepts and Changes

### Relay Pool Management

```javascript
import { SimplePool } from 'nostr-tools';

// Create a relay pool
const pool = new SimplePool();

// List of relays to connect to
const relays = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nostr-pub.wellorder.net',
  'wss://relay.current.fyi',
  'wss://nos.lol',
  'wss://relay.snort.social'
];
```

### Fetching Events

```javascript
// Old NDK approach
const events = await ndk.fetchEvents({
  kinds: [1],
  authors: ['pubkey1', 'pubkey2']
});

// New nostr-tools approach
const events = await pool.list(relays, [{
  kinds: [1],
  authors: ['pubkey1', 'pubkey2']
}]);
```

### Subscribing to Events

```javascript
// Old NDK approach
const subscription = ndk.subscribe({
  kinds: [1],
  "#t": ["running"]
});

subscription.on('event', handleEvent);
subscription.on('eose', handleEose);

// New nostr-tools approach
const sub = pool.sub(relays, [{
  kinds: [1],
  "#t": ["running"]
}]);

sub.on('event', handleEvent);
sub.on('eose', handleEose);
```

### Creating and Publishing Events

```javascript
// Old NDK approach
const event = new NDKEvent(ndk);
event.kind = 1;
event.content = "Hello Nostr!";
event.tags = [["t", "running"]];
await event.sign();
await event.publish();

// New nostr-tools approach
// Using NIP-07 browser extension
const event = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  content: "Hello Nostr!",
  tags: [["t", "running"]],
  pubkey: await window.nostr.getPublicKey()
};

const signedEvent = await window.nostr.signEvent(event);
await pool.publish(relays, signedEvent);
```

## Architecture

The migration maintains the same application architecture but replaces the underlying Nostr client library:

1. `utils/nostr.js` - Core Nostr utility functions with nostr-tools implementation
2. `hooks/useRunFeed.js` - Custom hook for fetching and managing the feed data
3. `hooks/usePostInteractions.js` - Custom hook for handling post interactions (likes, reposts, etc.)

## Benefits of nostr-tools

1. **Smaller bundle size** - nostr-tools is more lightweight than NDK
2. **Simpler API** - Direct access to core Nostr functionality
3. **Better compatibility** - More widely used in the Nostr ecosystem
4. **More flexible** - Easier to customize for specific requirements

## Important Notes

- The application now connects to a predefined list of relays rather than using relay discovery
- Event subscription behavior should remain the same, but with a more performant implementation
- NIP-07 (browser extension) integration for signing events remains in place

## Future Improvements

- Add relay management to allow users to customize their relay list
- Implement more efficient caching mechanisms
- Consider adding robust retry and error handling mechanisms for relay connections 