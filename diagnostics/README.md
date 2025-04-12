# NIP29 Diagnostics Tool

A diagnostic tool for testing NIP29 group functionality in the RUNSTR application.

## Overview

This tool helps identify issues with NIP29 group discovery by running comprehensive tests for:

1. **Relay Connectivity** - Tests connection to Nostr relays and verifies NIP29 support
2. **Authentication** - Verifies Nostr keypairs, feature flags, and user authentication
3. **Group Discovery** - Tests raw and app-level group discovery functionality

The tool will generate detailed reports identifying critical issues and providing recommendations.

## Installation

1. Make sure Node.js (v14 or higher) is installed on your system
2. Navigate to the diagnostics directory:
   ```
   cd diagnostics
   ```
3. Install dependencies:
   ```
   npm install
   ```

## Usage

Run the diagnostic tool:

```
npm start
```

This will:
1. Test connection to Nostr relays
2. Check authentication settings
3. Test NIP29 group discovery
4. Generate a detailed report with recommendations

The test results will be displayed in the console and saved to a JSON file for further analysis.

## Common Issues and Solutions

### "Nostr groups feature flag is disabled"

This is the most common issue. Enable the feature flag in your browser console:

```javascript
localStorage.setItem("nostr_groups_enabled", "true")
```

Then restart the app.

### "No relay supporting NIP29 was found"

Ensure you have at least one relay that supports NIP29 groups, like:
- wss://relay.0xchat.com

### "NIP29Bridge initialization failed"

Check that:
1. The Nostr groups feature flag is enabled
2. The user is authenticated with a valid Nostr keypair
3. The app has internet connectivity

## Interpreting Results

The tool will provide clear recommendations at the end of the test run. Focus on:

1. **Critical Issues** - These must be fixed to enable NIP29 functionality
2. **Recommended Actions** - Prioritized list of fixes, with implementation details

## Files

- `nip29-diagnostics.js` - Main diagnostic script
- `tests/` - Individual test modules
- `polyfills/` - Browser environment polyfills for Node.js

---

For more detailed information about NIP29, see the [NIP29 specification](https://github.com/nostr-protocol/nips/blob/master/29.md). 