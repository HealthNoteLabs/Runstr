# RUNSTR for Android

This document outlines the Android-specific setup and functionality for the RUNSTR application.

## Overview

RUNSTR is a Nostr-powered running app designed exclusively for Android. It uses nostr-tools to connect to the Nostr network and allows runners to share their running experiences, like and comment on posts, and engage with the running community.

## Android Setup

### Prerequisites

- Android Studio (latest version)
- Node.js 16+ and npm
- JDK 11+

### Building for Android

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the app and sync with Android:
   ```bash
   npm run build:android
   ```

3. Open the Android project:
   ```bash
   npm run android
   ```

4. In Android Studio, you can run the app on an emulator or physical device.

## Android-Specific Optimizations

This app has been optimized specifically for Android with the following features:

### Performance Optimizations

1. **Network Handling**
   - Optimized network timeout handling for mobile connections
   - Connection retries with exponential backoff
   - Chunked data loading to prevent memory issues
   - Reduced payload sizes for mobile data

2. **UI Performance**
   - Lazy loading images
   - Throttled scroll event handling
   - Limited render batching
   - Reduced animations on lower-end devices

3. **Battery Optimization**
   - Shorter connection timeouts
   - Optimized subscription management
   - Automatic cleanup of unused connections
   - Passive event listeners

### Mobile UI Improvements

1. **Touch-Friendly Controls**
   - Larger tap targets for buttons
   - Mobile-optimized image viewing
   - Simplified navigation

2. **Offline Support**
   - Local caching of key data
   - Graceful error handling

## Architecture

The application uses a modified nostr-tools implementation specifically designed for Android:

1. **Key Management**
   - Secure key storage for Android
   - NIP-07 alternatives for mobile

2. **Relay Management**
   - Optimized relay pool for mobile networks
   - Automatic relay failover
   - Prioritized relay connections

3. **Data Loading**
   - Mobile-optimized pagination
   - Reduced data usage with smaller query limits
   - Time windowing for historical data

## Security Considerations

1. **Private Key Storage**
   - For a production app, private keys should be stored in Android's KeyStore system
   - Implementation currently uses a simulated key storage system

2. **Network Security**
   - All connections are made via secure WebSockets
   - Certificate pinning should be implemented for production

## Troubleshooting

### Common Issues

1. **Slow Loading**
   - Try connecting to different relays
   - Check mobile network signal strength

2. **Connection Failures**
   - Ensure you have a stable internet connection
   - Try restarting the app

3. **High Battery Usage**
   - Limit background usage of the app
   - Close the app when not in use

## Future Improvements

1. **Background Sync**
   - Implement WorkManager for periodic background syncing
   - Push notification support

2. **Offline Mode**
   - Complete offline functionality with local database
   - Sync queuing for offline actions

3. **Performance**
   - Native image handling
   - Further optimization for low-end devices 