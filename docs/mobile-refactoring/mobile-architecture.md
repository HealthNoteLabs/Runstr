# RUNSTR Mobile Architecture

## Overview

RUNSTR is being refactored to focus exclusively on mobile platforms, specifically Android. The architecture is designed to optimize for mobile-specific concerns including:

- Battery efficiency
- Offline capability
- Background processing
- Resilient networking
- Touch-optimized UI

## Core Architecture Components

### 1. Application Layer

```
src/
  App.jsx                 # Application entry point
  AppRoutes.jsx           # Mobile-optimized routing
  main.jsx                # Main entry point
```

### 2. Mobile Screens

```
src/screens/
  HomeScreen.jsx          # Main dashboard
  TrackingScreen.jsx      # Activity tracking
  HistoryScreen.jsx       # Run history
  ProfileScreen.jsx       # User profile
  SettingsScreen.jsx      # Settings
  social/
    FeedScreen.jsx        # Social feed
    PostDetailScreen.jsx  # Post details
  teams/
    TeamsScreen.jsx       # Teams listing
    TeamDetailScreen.jsx  # Team details
```

### 3. Mobile Components

```
src/components/
  ui/                     # Base UI components
    Button.jsx            # Touch-optimized button
    BottomSheet.jsx       # Mobile-native bottom sheet
    TabBar.jsx            # Mobile tab navigation
    LoadingIndicator.jsx  # Mobile loading states
  tracking/               # Tracking components
    TrackerControls.jsx   # Start/pause/stop controls
    SplitsList.jsx        # Run splits display
  social/                 # Social components
    PostItem.jsx          # Post display
    PostComposer.jsx      # Post creation
```

### 4. Mobile Services

```
src/services/
  storage/
    preferences.js        # Capacitor Preferences wrapper
    secureStorage.js      # Secure key storage
  tracking/
    locationService.js    # Location tracking
    activityService.js    # Activity recording
  network/
    nostrService.js       # Mobile-optimized Nostr client
    offlineQueue.js       # Offline publishing queue
  background/
    tasksService.js       # Background task management
```

### 5. Mobile Contexts

```
src/contexts/
  AppStateContext.jsx     # Foreground/background state
  NetworkContext.jsx      # Connection management
  PreferencesContext.jsx  # App settings
  RunTrackerContext.jsx   # Tracking state
  NostrContext.jsx        # Nostr connectivity
```

### 6. Mobile Utilities

```
src/utils/
  storage.js              # Storage utilities
  location.js             # Location utilities
  battery.js              # Battery optimization
  formatters.js           # Display formatters
  platform.js             # Platform detection
```

## Key Mobile Design Patterns

### 1. Offline-First Data Flow

```
User Action → Local Storage → Sync Queue → Network Publish → Confirmation
```

Example implementations:
- All writes go to local storage first
- Background sync process handles network publishing
- Optimistic UI updates for improved perceived performance

### 2. Mobile State Management

```
App State (Foreground/Background) → Service State → Component State
```

Key principles:
- Services maintain state during app lifecycle
- Components reflect service state
- App lifecycle events trigger appropriate state transitions

### 3. Battery-Efficient Processing

```
Adaptive Frequency → Batched Operations → Resource Release
```

Implementation details:
- Location updates adapt based on movement speed
- Network operations batch where possible
- Resources released when app in background

### 4. Mobile Navigation Flow

```
Tab-Based Navigation → Modal Workflows → Back Navigation
```

User experience:
- Primary navigation through bottom tabs
- Context-specific actions in bottom sheets
- Consistent back navigation patterns

## Technical Implementation

### Native Bridge (Capacitor)

The application uses Capacitor as the native bridge, with these key plugins:

- `@capacitor/preferences`: For persistent storage
- `@capacitor/app`: For app lifecycle management
- `@capacitor-community/background-geolocation`: For location tracking
- `@capacitor/camera`: For image capture
- `@capacitor/network`: For network status monitoring

### State Persistence

Mobile state persistence follows this hierarchy:

1. **Ephemeral State**: In-memory application state
2. **Session State**: Preserved during app session (Preferences)
3. **Persistent State**: Long-term storage (Preferences)
4. **Secure State**: Encrypted storage for sensitive data (Secure Storage)

### Background Processing

The app implements these background capabilities:

1. **Location Tracking**: Continues during run sessions
2. **Event Publishing**: Queues events when offline
3. **State Synchronization**: Updates state on app resume

### Mobile-Specific UI Guidelines

1. **Touch Targets**: Minimum 44×44 pixels
2. **Safe Areas**: Respect device notches and system UI
3. **Feedback**: Haptic and visual feedback for actions
4. **Loading States**: Clear visual indicators for network operations

## Migration Strategy

The application will be migrated to this architecture incrementally:

1. Replace core infrastructure (storage, network)
2. Update UI components one by one
3. Refactor screens to mobile-only patterns
4. Remove web-specific code and dependencies

Each component will be updated to follow these patterns, with a focus on preserving functionality while improving mobile performance. 