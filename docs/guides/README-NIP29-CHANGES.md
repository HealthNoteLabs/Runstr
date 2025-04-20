# NIP-29 Implementation Fixes

## Summary of Changes

We've fixed the NIP-29 implementation to ensure the app displays real group metadata from the Nostr network instead of hardcoded placeholder data. This allows users to properly view and interact with Nostr groups (kind 39000) and their messages (kind 39001).

## Key Changes

### 1. Removed Hardcoded Placeholders

- Removed hardcoded name, description, and tags from `FEATURED_GROUPS` in `GroupDiscoveryScreen.jsx`
- Now only storing essential information (naddr and relay) for each featured group
- App now dynamically fetches and displays real metadata from the Nostr network

### 2. Added Direct WebSocket Approach

- Implemented a `fetchGroupMetadataDirectWS` function that uses direct WebSockets
- This provides a fallback method similar to the successful test script approach
- Follows the NIP-01 protocol for direct relay communication using `REQ` subscriptions

### 3. Improved Error Handling

- Added proper loading and error states for each group card
- Better UI feedback when groups fail to load
- Improved error messages that show actual failures instead of silently falling back to placeholders
- Added component-level error boundaries

### 4. Enhanced Parameter Handling 

- Added proper URL encoding/decoding for naddr values in navigation
- Fixed handling of the teamId parameter in TeamDetail.jsx
- Added clear debug information in error states

### 5. Added Graceful Fallbacks

- Each group now tries two different fetching methods before failing
- Added retry buttons for users when groups fail to load
- Better handling when no metadata is available

## Visual Improvements

- Added support for group pictures from metadata
- Dynamically extracts hashtags from the "about" field
- Shows loading spinners for individual groups during fetching
- Added card-specific error states

## Technical Details

The implementation now closely follows the NIP-29 specification:
- Uses kind 39000 events for group metadata
- Uses kind 39001 events for group messages 
- Follows the `kind:pubkey:identifier` format for group references
- Uses direct WebSocket communication as a fallback when SimplePool fails

## Test Verification

We've confirmed that our implementation works by running the `test:nip29` script, which successfully:
1. Parses naddr values ✅
2. Connects to relays ✅
3. Fetches group metadata ✅
4. Retrieves group messages ✅

These changes ensure that the app displays real NIP-29 group data from the Nostr network rather than hardcoded placeholders. 