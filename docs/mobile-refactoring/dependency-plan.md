# RUNSTR Dependency Management Plan

This document outlines the dependency changes required to support the mobile-first refactoring of RUNSTR.

## Current Dependencies

Based on package.json analysis, the project currently uses:

- React 18.x with React DOM (web)
- Capacitor 7.x as the native bridge
- @capacitor-community/background-geolocation for tracking
- nostr-tools for Nostr network integration
- Various utilities and UI components

## Dependency Changes

### Core Dependencies To Keep

```json
{
  "dependencies": {
    "@capacitor/android": "^7.0.1",
    "@capacitor/core": "^7.0.1",
    "@capacitor-community/background-geolocation": "^1.2.20",
    "nostr-tools": "^2.12.0",
    "react": "^18.3.1"
  }
}
```

### Web-Specific Dependencies To Remove

```json
{
  "dependencies": {
    // Remove web-specific packages
    "react-dom": "^18.3.1",     // Web rendering only
    "react-player": "^2.16.0"   // Replace with native-compatible alternative
  }
}
```

### Mobile-Specific Dependencies To Add

```json
{
  "dependencies": {
    // Add Capacitor plugins for native functionality
    "@capacitor/preferences": "^7.0.0",      // For storage
    "@capacitor/haptics": "^7.0.0",          // For tactile feedback
    "@capacitor/network": "^7.0.0",          // For network monitoring
    "@capacitor/device": "^7.0.0",           // For device info
    "@capacitor/app": "^7.0.0",              // For app lifecycle
    "@capacitor/camera": "^7.0.0",           // For camera access
    "@capacitor/toast": "^7.0.0",            // For native toast messages
    "@capacitor/share": "^7.0.0",            // For native sharing
    "@capacitor/dialog": "^7.0.0",           // For native dialogs
    
    // Mobile UI and functionality
    "react-swipeable": "^7.0.0",             // For swipe gestures
    "react-swipeable-list": "^1.9.1",        // For swipeable lists
    "react-native-track-player": "^3.2.0"    // Replace react-player with mobile audio
  }
}
```

### Development Dependencies Changes

```json
{
  "devDependencies": {
    // Keep for building
    "@capacitor/cli": "^7.0.1",
    "@vitejs/plugin-react": "^4.3.3",
    "vite": "^5.4.10",
    
    // Add mobile-focused testing
    "detox": "^20.13.0",                     // E2E testing for mobile
    "@testing-library/react-native": "^12.3.0" // Testing mobile components
  }
}
```

## Version Compatibility

Ensure all Capacitor plugins are compatible with the core Capacitor version:

- All @capacitor/* packages should use the same major and minor version (7.0.x)
- React 18.x is compatible with all proposed dependencies
- nostr-tools 2.x works with the proposed architecture

## Implementation Plan

### 1. Initial Package Updates

Update package.json to add the core Capacitor plugins needed for the first phase:

```bash
npm install @capacitor/preferences @capacitor/haptics @capacitor/network @capacitor/app
```

### 2. Remove Web Dependencies

We'll remove web-specific packages once their functionality has been replaced:

```bash
npm uninstall react-dom
```

Note: Don't remove react-dom until all components have been migrated to mobile-specific implementations.

### 3. Add Mobile UI Dependencies

As each component is refactored, add the necessary mobile UI dependencies:

```bash
npm install react-swipeable react-swipeable-list
```

### 4. Update Capacitor Configuration

Update capacitor.config.json to configure the new plugins:

```json
{
  "appId": "com.runstr.app",
  "appName": "Runstr",
  "webDir": "dist",
  "plugins": {
    "BackgroundGeolocation": {
      "locationProvider": 1,
      "desiredAccuracy": 10,
      "stationaryRadius": 50,
      "distanceFilter": 30,
      "debug": true,
      "stopOnTerminate": false,
      "startForeground": true
    },
    "Preferences": {},
    "Haptics": {},
    "Network": {},
    "App": {}
  },
  "android": {
    "useLegacyBridge": true
  }
}
```

## Testing Dependencies

For each phase, ensure the necessary testing dependencies are in place:

1. Unit testing React components:
   - Continue using Vitest for core logic
   - Add mobile-specific mocks for Capacitor plugins

2. E2E testing:
   - Add Detox for mobile E2E testing after core refactoring
   - Configure for Android testing

## Offline Support Dependencies

For implementing offline-first architecture:

```bash
npm install idb    # IndexedDB wrapper for offline storage
```

## Peer Dependencies Resolution

Some dependencies may have peer dependency conflicts. If needed, use these resolutions:

```json
{
  "resolutions": {
    "react": "^18.3.1",
    "@capacitor/core": "^7.0.1"
  }
}
```

## Build Process Changes

Update Vite configuration (vite.config.js) to optimize for mobile:

```javascript
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        // Optimize for mobile
        passes: 2,
        drop_console: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react',
            'nostr-tools'
          ],
          'nostr': [
            'nostr-tools'
          ],
          'capacitor': [
            '@capacitor/core'
          ]
        }
      }
    }
  }
});
``` 