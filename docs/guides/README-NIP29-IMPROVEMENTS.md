# NIP-29 Group Membership Implementation Improvements

## Overview

This document describes the improved implementation of NIP-29 (Standardized Group Chat) membership management in the RUNSTR app. The updates fix previous issues with WebSocket connections by using standard Nostr relay operations for group membership events.

## Key Changes

1. **Standard NIP-29 Event Types**
   - Uses proper event kinds as specified in NIP-29:
   - `kind 40`: Group creation events
   - `kind 41`: Group metadata events
   - `kind 42`: Group member addition events
   - `kind 43`: Group member removal events
   - `kind 44`: Group join request events

2. **Relay-Based Communication**
   - Removed dependencies on custom WebSocket services
   - Uses standard Nostr relays (with `SimplePool`) for all communication
   - More resilient by supporting any NIP-29 compatible relay

3. **Improved Caching**
   - Efficient per-group, per-user membership caching
   - Cached data persisted in localStorage for offline access
   - Selective cache invalidation for specific group/user combinations

4. **Reactive Membership Status**
   - Real-time membership updates through Nostr subscriptions
   - Automatic cache invalidation when membership events are received

## Implementation Files

- `src/services/GroupMembershipManager.js` - Core implementation for checking membership status
- `src/utils/nostr/groups/membership.js` - Group operations (join, leave, add/remove members)
- `src/hooks/useGroupMembership.js` - React hook for easy integration in components

## Usage

### Checking Membership

```javascript
import groupMembershipManager from '../services/GroupMembershipManager';

// Check if user has joined a group
const isMember = await groupMembershipManager.hasJoinedGroup(
  'naddr1...', // Group naddr
  userPubkey
);
```

### Using the React Hook

```javascript
import { useGroupMembership } from '../hooks/useGroupMembership';

function GroupComponent({ group }) {
  const { 
    isMember, 
    isLoading, 
    error, 
    addUser, 
    removeUser, 
    refresh 
  } = useGroupMembership(group);

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h2>{group.name}</h2>
      {isMember ? (
        <button onClick={() => removeUser()}>Leave Group</button>
      ) : (
        <button onClick={() => addUser()}>Join Group</button>
      )}
      
      {/* Admin features - add another user */}
      <button onClick={() => addUser('npub1...')}>Add User</button>
    </div>
  );
}
```

### Adding/Removing Members

```javascript
import { addUserToGroup, removeUserFromGroup } from '../utils/nostr/groups/membership';

// Add a user to a group
await addUserToGroup('naddr1...', 'npub1...');

// Remove a user from a group
await removeUserFromGroup('naddr1...', 'npub1...');
```

## Technical Details

1. **Membership Detection**
   - Checks for `kind 42` events that add the user
   - Checks if user has posted to the group (implicit membership)
   - Checks if the group is public/unrestricted
   - Verifies no subsequent removal events exist

2. **Event Publishing**
   - Signs and publishes events using standard Nostr tools
   - Properly formats tags according to NIP-29 specification
   - Uses `d` tags for group identifiers and `p` tags for user identifiers

3. **Subscription Handling**
   - Sets up proper subscriptions for membership-related events
   - Efficiently handles events with automatic state updates
   - Properly cleans up subscriptions when components unmount

## Benefits

1. **Reliability**: No more dependency on specific WebSocket servers that might go down
2. **Compatibility**: Works with any standard Nostr relay
3. **Performance**: Efficient caching reduces network requests
4. **Standards Compliance**: Follows NIP-29 specification exactly
5. **Developer Experience**: Simple hook-based API for components 