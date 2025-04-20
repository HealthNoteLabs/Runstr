# RUNSTR Run Club Feature

The Run Club feature connects you with running communities on Nostr.

## Features

- **My Clubs**: View Nostr groups (NIP-29) you follow or have joined, managed via your Nostr NIP-51 lists.
- **Discover Clubs**: Access two featured public running groups: "Messi Run Club" and "#RUNSTR".
- **Real-time Chat**: Communicate within groups using Nostr's decentralized messaging (Kind 39001).
- **Pin Messages**: Locally pin important messages within a group chat for quick reference.
- **Coming Soon**: Events and challenges features are planned for future updates.

## Technical Implementation

The Run Club feature uses the following Nostr standards:

- **NIP-29 Groups**: Groups are identified by `naddr` coordinates, using kind 39000 for group metadata.
- **NIP-51 Lists**: User-followed groups ("My Clubs") are fetched from the user's Kind 30001 list event (assuming `#d` tag "groups").
- **Kind 39000**: Group metadata is fetched using the kind, pubkey, and identifier from the group's naddr.
- **Kind 39001**: Group chat messages, referenced using the '#e' tag with the group's identifier.

### Key Components

1. **Direct Relay Communication**: The app communicates primarily with wss://groups.0xchat.com for group functionality, with fallback to other relays.
2. **Nostr Client Utilities**: 
   - Parse `naddr` to extract group coordinates (kind 39000, pubkey, identifier)
   - Fetch group metadata using kind 39000
   - Fetch and post messages using kind 39001 with '#e' tag
   - Fetch NIP-51 lists for user's joined groups
3. **Local Caching**: User's joined group list and pinned messages are cached locally for better performance.

## Getting Started

1.  Navigate to the "RUN CLUB" section in the main menu.
2.  Choose "My Clubs" to see groups you follow on Nostr (requires Nostr login).
3.  Choose "Discover Clubs" to see the two featured public groups.
4.  Click on a club to view its chat.
5.  You'll need a Nostr key (connect in Settings) to send messages or see "My Clubs".

### Message Features

- Messages appear in chronological order.
- Hover over a message to reveal the "Pin" option (stored locally).
- Pinned messages appear at the top of the chat.

## Future Enhancements

- Ability to share run data directly in the chat
- Integration with Nostr zaps for tipping
- Group run scheduling and coordination
- Run Club challenges and competitions

## Feedback

This feature is in active development. Feedback is welcome! 