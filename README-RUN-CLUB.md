# RUNSTR Run Club Feature

The Run Club feature is a new addition to RUNSTR that enables users to form NIP-28 Groups and participate in chatrooms with other runners who share similar interests.

## Features

- **Create Run Clubs**: Create themed running groups where members can discuss training, share tips, or organize running events.
- **Join Run Clubs**: Search for and join existing running groups based on your interests.
- **Real-time Chat**: Communicate with other club members in real-time using Nostr's decentralized messaging.
- **Notifications**: Get notified when there are new messages in your clubs.
- **Message Moderation**: Hide unwanted messages and mute users as needed.

## Technical Implementation

The Run Club feature is built using the [NIP-28 Public Chat](https://github.com/nostr-protocol/nips/blob/master/28.md) specification on the Nostr protocol. This provides a decentralized, censorship-resistant platform for runners to connect without relying on a central server.

### Key Components

1. **Channel Creation (Kind 40)**: Users can create new Run Clubs that are published as Kind 40 events to the Nostr network. Metadata is stored in the content as JSON.
2. **Channel Metadata (Kind 41)**: Updates to channel information are published as Kind 41 events.
3. **Channel Messages (Kind 42)**: Messages within Run Clubs are published as Kind 42 events, linked to the channel.
4. **Hide Message (Kind 43)**: Users can hide inappropriate messages using Kind 43 events.
5. **Mute User (Kind 44)**: Users can mute other users using Kind 44 events.
6. **Real-time Updates**: The application subscribes to channel messages in real-time using Nostr relays.
7. **Profile Integration**: Messages display user profiles based on Kind 0 metadata events.

### Compliance with NIP-28

Our implementation strictly follows the NIP-28 specification:

- Channel metadata is stored in the content field as JSON
- Proper NIP-10 "e" tag markers for root and reply references
- Implementation of "p" tags for reply references
- Support for relay recommendations in channel metadata
- Client-side filtering of hidden messages and muted users

### Inspired By

The implementation was inspired by [Chachi](https://github.com/purrgrammer/chachi), a Nostr group chat client built by the Nostr community.

## Getting Started

To start using the Run Club feature:

1. Navigate to the "RUN CLUB" section in the main menu
2. Go to the "Find Clubs" tab to discover existing Run Clubs
3. Or create your own by clicking on the "Create Club" tab
4. Once you've joined a club, you can send messages and interact with other members

### Moderation Features

To moderate your experience:
- Click the "•••" menu on any message to see options
- Select "Hide Message" to remove a specific message from your view
- Select "Mute User" to stop seeing messages from a specific user

## Future Enhancements

- Ability to share run data directly in the chat
- Integration with Nostr zaps for tipping great running advice
- Group run scheduling and coordination
- Private Run Clubs with invitation-only access
- Run Club challenges and competitions

## Feedback

This feature is in active development. If you have any feedback or suggestions, please reach out to the RUNSTR team. 