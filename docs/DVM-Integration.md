# RUNSTR DVM Integration

This document explains how RUNSTR app integrates with the RUNSTR DVM (Data Vending Machine) to fetch and display running-related notes from the Nostr network.

## Overview

RUNSTR DVM is a Nostr-based Data Vending Machine that processes and monitors running-related notes according to the NIP-90 specification. The DVM provides a more efficient way to fetch running-related content without having to directly query the Nostr network.

## Integration Architecture

The integration allows the app to fetch running notes in two ways:

1. **DVM API**: Using the HTTP API provided by the RUNSTR DVM
2. **Direct Nostr**: Fallback mode that connects directly to Nostr relays

Users can toggle between these two modes in the RunClub screen.

## Components

### DVMService

A service that handles communication with the DVM:

- `getRunningFeed()`: Fetches running-related notes via the DVM's HTTP API
- `parseRunningNote()`: Sends a note to the DVM for parsing running information
- `requestWorkoutNotes()`: Alternative method using the Nostr protocol directly (NIP-90)

### Configuration

DVM settings are controlled via the `dvm.config.js` file which includes:

- API URLs for different environments
- DVM pubkey
- Relay list
- Default parameters

### User Interface

The RunClub screen includes:

- A toggle to switch between DVM and direct Nostr
- Information about the current data source
- Error handling with fallback options

## Setup Instructions

1. Configure the DVM URL in `src/config/dvm.config.js`
2. Add the DVM pubkey to your environment variables or directly in the config file
3. Ensure the required NPM packages are installed:
   ```bash
   npm install nostr-tools
   ```

## API Endpoints

The DVM provides the following endpoints:

### GET /api/running_feed

Fetches a feed of running-related notes.

**Parameters:**
- `limit`: Maximum number of notes to return (default: 10)
- `since`: Unix timestamp to fetch notes from
- `until`: Unix timestamp to fetch notes until
- `include_workouts`: Boolean to include structured workout data (NIP-101e)

**Response:**
```json
{
  "result": {
    "feed": [
      {
        "id": "note_id",
        "content": "Just completed a 5K run...",
        "created_at": 1633046400,
        "author": {
          "name": "Runner",
          "display_name": "Fast Runner",
          "picture": "https://example.com/avatar.jpg",
          "pubkey": "npub..."
        },
        "hashtags": ["running", "5k"],
        "run_data": {
          "distance": 5000,
          "duration": 1800,
          "pace": 360
        }
      }
    ],
    "total": 100
  }
}
```

### POST /api/running_notes

Parses running information from text content.

**Request:**
```json
{
  "content": "Just ran 5km in 25 minutes!"
}
```

**Response:**
```json
{
  "result": {
    "extractedData": {
      "distance": 5000,
      "duration": 1500,
      "pace": 300,
      "elevation": null
    }
  }
}
```

## Fallback Mechanism

If the DVM is unavailable, the app automatically falls back to direct Nostr connection. Users can also manually switch between the two modes. 