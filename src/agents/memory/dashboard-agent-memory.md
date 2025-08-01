# Dashboard Agent Memory

**Agent**: DashboardAgent  
**Location**: `src/agents/DashboardAgent.js`  
**Last Updated**: 2025-01-31  
**Version**: 1.0.0

## Mission Statement
Handle all activity tracking, run data management, feed operations, and workout publishing functionality in the Runstr application.

## Key Files to Reference

### Core Activity Tracking
- `src/services/RunTracker.js` - GPS tracking service and core run logic
- `src/services/RunDataService.js` - Local storage and data persistence
- `src/contexts/ActivityModeContext.js` - Activity mode management (run/walk/cycle)
- `src/components/RunTracker.jsx` - Main activity tracking UI component
- `src/pages/RunHistory.jsx` - Run history display and management

### Feed & Publishing
- `src/utils/feedFetcher.js` - Activity feed data retrieval
- `src/utils/feedProcessor.js` - Feed data processing and enrichment
- `src/utils/feedCache.js` - Feed caching system
- `src/utils/runCalculations.js` - Running metrics and calculations

### Integration Points
- `src/components/ActivityModeBanner.jsx` - Activity mode display and team context
- `src/lib/ndkSingleton.ts` - NDK instance for Nostr publishing
- `src/contexts/NostrContext.jsx` - Nostr connection and authentication
- `src/utils/settingsManager.js` - Auto-posting and preferences

### Mobile & GPS
- Capacitor Geolocation plugin for GPS tracking
- Background location tracking capabilities
- Battery optimization considerations

## Current State & Capabilities

### ✅ Implemented Features
- Activity mode selection (run/walk/cycle)
- GPS tracking with start/pause/resume/stop
- Real-time activity data collection (distance, pace, time, calories)
- Local storage of run data
- Activity history management
- Manual workout publishing to Nostr
- Team integration in workout posts
- Feed retrieval and display

### 🚧 Partially Implemented
- Auto-publishing based on settings
- Advanced metrics calculation
- Activity statistics and trends
- Feed interaction and social features

### ❌ Not Yet Implemented
- Route visualization and mapping
- Advanced GPS filtering and accuracy improvements
- Workout templates and goals
- Social feed interactions (likes, comments)
- Offline mode for areas with poor connectivity

## Success Patterns

### Activity Tracking Lifecycle ✅
```javascript
// Start activity
const startResponse = await sendMessage('Dashboard', 'activity.start', {
  mode: 'run' // or 'walk', 'cycle'
});

// Stop and save activity  
const stopResponse = await sendMessage('Dashboard', 'activity.stop', {});

// Publish to Nostr
if (stopResponse.success) {
  await sendMessage('Dashboard', 'workout.publish', {
    activity: stopResponse.data.activity,
    includeTeam: true
  });
}
```
**Why it works**: Follows proper lifecycle and integrates with existing RunTracker service.

### Team-Integrated Publishing ✅
```javascript
// Publish with team context
const result = await sendMessage('Dashboard', 'workout.publish', {
  activity: workoutData,
  includeTeam: true // Automatically adds default team tags
});
```
**Why it works**: Leverages Teams agent for default team selection and proper NIP-29 tagging.

### Activity History Retrieval ✅
```javascript
// Get paginated history
const history = await sendMessage('Dashboard', 'activity.getHistory', {
  limit: 20,
  offset: 0
});
```
**Why it works**: Uses existing RunDataService for efficient local storage access.

## Failure Patterns & Lessons Learned

### ❌ Direct GPS Access Without Service
**Problem**: Initially tried to access GPS directly in agent without using RunTracker service.
**Lesson**: Always use the existing `RunTracker.js` service - it handles permissions, background tracking, and mobile-specific issues.
**Solution**: Agent delegates to RunTracker service for all GPS operations.

### ❌ Publishing Without Authentication Check
**Problem**: Workout publishing failed when user wasn't authenticated.
**Lesson**: Always verify Nostr connection and authentication before publishing.
**Solution**: Check CoreServices auth state first: `await sendMessage('CoreServices', 'auth.getState', {})`

### ❌ Missing Activity Mode Context
**Problem**: Activity started without proper mode selection.
**Lesson**: Activity mode affects tracking behavior and data interpretation.
**Solution**: Always specify mode explicitly or load from settings: `await loadActivityMode()`

### ❌ Incomplete Data Persistence
**Problem**: Activity data lost when app closed during tracking.
**Lesson**: Must persist intermediate tracking data, not just final results.
**Solution**: Use RunDataService to save progress periodically during tracking.

## Known Issues & Workarounds

### Issue 1: Background GPS Tracking
**Problem**: GPS tracking may stop when app goes to background on some devices.
**Status**: Partially mitigated by Capacitor background mode
**Workaround**: Encourage users to keep app active during runs
**Fix**: Implement proper background task handling and notification system

### Issue 2: GPS Accuracy in Urban Areas
**Problem**: GPS accuracy can be poor in dense urban environments.
**Status**: Known limitation
**Workaround**: Use GPS filtering and smoothing algorithms
**Fix**: Implement Kalman filtering or similar smoothing techniques

### Issue 3: Feed Performance
**Problem**: Large activity feeds can be slow to load.
**Status**: Mitigated by caching
**Workaround**: Use feed caching with 30-minute TTL
**Fix**: Implement virtualized scrolling for large feeds

### Issue 4: Offline Mode
**Problem**: No offline support for areas with poor connectivity.
**Status**: Not implemented
**Workaround**: Queue activities for later publishing
**Fix**: Implement offline queue with retry mechanism

## Best Practices

### Activity State Management
Always maintain proper activity state:
```javascript
this.trackingState = 'active'; // idle, active, paused
this.currentActivity = {
  id: crypto.randomUUID(),
  mode,
  startTime: Date.now(),
  // ... other properties
};
```

### Data Validation
Validate activity data before processing:
```javascript
if (!activity || !activity.distance || activity.distance < 0) {
  throw new AgentError('Invalid activity data', ErrorCodes.VALIDATION_ERROR);
}
```

### Settings Integration
Check user preferences before auto-actions:
```javascript
const settings = await this.sendMessage('Settings', 'settings.get', { 
  key: 'autoPostToNostr' 
});
if (settings.success && settings.data.value) {
  await this.publishWorkout({ activity });
}
```

### Error Recovery
Handle GPS and network failures gracefully:
```javascript
try {
  await runTracker.startTracking();
} catch (error) {
  // Fallback to manual distance entry or pedometer
  console.warn('GPS tracking failed, using fallback method');
}
```

## Recent Wins 🎉

- **Team Integration**: Successfully integrated team context in workout publishing
- **Activity Lifecycle**: Robust start/pause/resume/stop workflow
- **Data Persistence**: Reliable local storage of activity data
- **Feed Caching**: Improved feed performance with smart caching
- **Manual Publishing**: Enhanced manual posting with workout summaries

## Immediate Priorities

1. **Auto-Publishing**: Complete auto-publishing based on user settings
2. **Advanced Metrics**: Implement heart rate zones, cadence, and other advanced metrics
3. **Route Visualization**: Add basic route mapping and visualization
4. **Offline Support**: Implement offline activity queueing
5. **Feed Interactions**: Add like/comment functionality to activity feed

## Integration Notes

### With Teams Agent
- Default team selection affects workout publishing
- Team challenges and competitions require activity data
- Team statistics aggregate member activities

### With Profile Agent
- Activity completion triggers achievement checks
- Statistics updates require activity data
- Leaderboard positioning based on activity metrics

### With Settings Agent
- Auto-publishing preferences control behavior  
- Activity mode preferences from settings
- Units (km/miles) affect display and calculations

### With Core Services Agent
- All publishing requires Nostr authentication
- Relay connectivity affects data availability
- NDK singleton used for all Nostr operations

## Message API

### Activity Control
- `activity.start` - Start GPS tracking for new activity
- `activity.pause` - Pause current activity
- `activity.resume` - Resume paused activity  
- `activity.stop` - Stop and save current activity
- `activity.getCurrentState` - Get current tracking state

### Data Management
- `activity.getHistory` - Retrieve activity history
- `activity.setMode` - Set activity mode (run/walk/cycle)
- `workout.publish` - Publish activity to Nostr
- `workout.getStats` - Get activity statistics

### Feed Operations
- `feed.get` - Retrieve activity feed
- `feed.post` - Post to activity feed

Remember: Always consult this memory before working with activity tracking functionality, and update this document after significant successes or failures.