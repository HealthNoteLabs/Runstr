# RUNSTR NIP-29 Implementation

This document provides details about the NIP-29 (Nostr Group Chat) implementation in the RUNSTR application.

## Overview

RUNSTR uses NIP-29 to connect runners with running communities directly on the Nostr network. This implementation:

1. Allows discovery of running-focused Nostr groups
2. Provides real-time group chat capabilities
3. Enables joining groups using standard NIP-51 mechanism
4. Uses a truly decentralized approach - all data is stored on the Nostr network

## Technical Implementation

### Group Discovery

The application shows two featured running clubs:
- Messi Run Club: `naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqsp4vfsnswrxve3rwdmyxgun2vnrx4jnvef5xs6rqcehxu6kgcmrvymkvvtpxuerwwp4xasn2cfhxymnxdpexsergvfhx3jnjce5vyunvg7fw59`
- #RUNSTR: `naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqspevfjxxcehx4jrqvnyxejnqcfkxs6rwc3kxa3rxcnrxdjnxctyxgmrqv34xasnscfjvccnswpkvyer2etxxgcngvrzxcerzetxxccxznx86es`

These groups are fetched directly from the Nostr network using their naddr identifiers.

### Nostr Standards Compliance

The implementation follows these Nostr Implementation Possibilities (NIPs):

- **NIP-29**: Core group chat functionality 
  - Kind 39000 for group metadata
  - Kind 39001 for group messages
  - Group events are referenced using `kind:pubkey:identifier` format

- **NIP-51**: Group membership
  - Stores group membership in a kind 30001 list event with `d` tag value of "groups"
  - References groups using `a` tags with the format `kind:pubkey:identifier`

### Key Components

#### Group Discovery Screen

`GroupDiscoveryScreen.jsx` fetches metadata from real Nostr groups and displays them to users.

```javascript
// Fetch real NIP-29 group metadata
const groupMetadata = await fetchGroupMetadataByNaddr(group.naddr);
```

#### Team Detail Screen

`TeamDetail.jsx` provides the group chat functionality:

```javascript
// Setup subscription to real-time messages
const filter = {
  kinds: [39001], // NIP-29 kind for group messages
  '#e': [groupIdentifier],
  since: Math.floor(Date.now() / 1000) - 10
};
```

#### Nostr Client Utilities

`nostrClient.js` handles all Nostr interaction:

- `parseNaddr`: Decodes NIP-19 naddr strings to extract group components
- `fetchGroupMetadataByNaddr`: Fetches group metadata using naddr
- `fetchGroupMessages`: Gets group chat messages (kind 39001)
- `sendGroupMessage`: Publishes messages to the group
- `joinGroup`: Adds a group to user's list using NIP-51
- `hasJoinedGroup`: Checks if user has joined a group

### Relay Strategy

The implementation prioritizes the following relays:
- `wss://groups.0xchat.com` (primary for NIP-29 groups)
- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.nostr.band`
- `wss://relay.snort.social`
- `wss://purplepag.es`

## Local Data Usage

The implementation is fully Nostr-native with minimal use of local storage:
- Group membership is stored on Nostr via NIP-51 lists
- Messages are stored on Nostr relays
- Only pinned messages are stored locally in browser localStorage

## Testing

You can test this implementation by:
1. Connecting a Nostr key in Settings
2. Navigating to "Discover Clubs" to see available running groups
3. Joining a group and viewing/sending messages
4. Checking that the same groups are visible in other NIP-29 compatible clients

## Resources

- [NIP-29 Specification](https://github.com/nostr-protocol/nips/blob/master/29.md)
- [NIP-51 Specification](https://github.com/nostr-protocol/nips/blob/master/51.md)
- [Nostr Protocol](https://github.com/nostr-protocol/nostr) 