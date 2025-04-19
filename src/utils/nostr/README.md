# Nostr Client Module

This module provides a comprehensive interface for interacting with the Nostr protocol, with special focus on NIP-29 group support.

## Architecture

The module is organized into the following components:

```
src/utils/nostr/
  ├── index.js            # Main exports
  ├── connection.js       # Pool and relay management
  ├── auth.js             # Authentication and key management
  ├── events.js           # Event creation, publishing, subscription
  ├── nip19.js            # NIP-19 utilities
  ├── groups/
  │   ├── index.js        # Group functionality exports
  │   ├── metadata.js     # Group metadata fetching
  │   ├── membership.js   # Join/leave functionality
  │   └── messages.js     # Group messaging
  └── tests/
      └── connection.test.js # Test examples
```

## Key Features

- **Relay Management**: Optimized connection to prioritized relays
- **Authentication**: Support for Amber-authenticated Nostr keys
- **Group Support**: Full implementation of NIP-29 for groups/communities
- **Event Publishing**: Simplified event creation and publishing
- **Graceful Fallbacks**: NDK→nostr-tools fallback patterns

## Usage Examples

### Connection Management

```javascript
import { initializeNostr, fetchEvents } from '@utils/nostr';

// Initialize connection to relays
await initializeNostr();

// Fetch events with a filter
const events = await fetchEvents({ kinds: [1], limit: 10 });
```

### Group Functionality

```javascript
import { joinGroup, fetchGroupMessages, sendGroupMessage } from '@utils/nostr';

// Join a group using naddr
await joinGroup('naddr1...');

// Fetch group messages
const messages = await fetchGroupMessages('group_id');

// Send a message to a group
await sendGroupMessage(groupInfo, 'Hello group!');
```

## Dependencies

- **nostr-tools**: Core Nostr protocol implementation
- **NDK** (optional): For enhanced relay functionality

## Testing

Tests are located in the `tests/` directory and can be run using:

```bash
npm test
```

## Notes on Implementation

- The module prioritizes `wss://groups.0xchat.com` for NIP-29 group support
- NDK is used as a primary method with fallback to nostr-tools when needed
- Membership tracking uses both NIP-29 and NIP-51 for compatibility 