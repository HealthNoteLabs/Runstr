# Team Event System Architecture

## Overview

The team event system provides a complete solution for team captains to create events and manage participant approval, while giving users instant feedback when joining events.

## System Components

### 1. **Instant Participation** (`EventParticipationService.js`)
- **localStorage-based joins**: Users get immediate feedback when joining events
- **Mobile-optimized**: Works perfectly with Capacitor WebView localStorage
- **Hybrid approach**: Combines local data with official captain-managed lists
- **Reliable storage**: No complex Nostr event dependencies for basic functionality

### 2. **Captain Notifications** (`EventNotificationService.js`)
- **Join request notifications**: Sends Kind 31001 notification events when users join
- **Real-time updates**: Captains receive notifications about new join requests
- **Fallback messaging**: Optional direct message notifications for important requests
- **Notification management**: Track and mark notifications as processed

### 3. **Captain Management UI** (`CaptainNotificationsModal.jsx`)
- **Join request dashboard**: Shows pending participant requests
- **Approve/Deny actions**: One-click approval to add users to official lists
- **Real-time updates**: Auto-refreshes every 30 seconds
- **User-friendly interface**: Clean modal with participant details and actions

### 4. **Event Leaderboards** (`useEventLeaderboard.js`)
- **Workout-based rankings**: Queries Kind 1301 workout events from participants
- **Time-based filtering**: Only shows activities during event timeframe
- **Multiple metrics**: Ranks by distance, duration, workout count
- **Real-time updates**: Updates as participants complete workouts

## User Flows

### **For Regular Users:**
1. **Discover Events**: Browse team events in the Events tab
2. **Join Events**: Click "Join Event" → immediate localStorage save → instant UI feedback
3. **Notification Sent**: System automatically notifies team captain of join request
4. **Await Approval**: User shows as "participating locally" until captain approval
5. **Official Participation**: Once approved, user appears in official participant list
6. **Compete**: Complete workouts during event period to appear on leaderboard

### **For Team Captains:**
1. **Create Events**: Use existing event creation system
2. **Receive Notifications**: Get notified when users request to join events
3. **Review Requests**: Click "Join Requests" button to see pending participants
4. **Approve/Deny**: One-click actions to manage event participation
5. **Official Lists**: Approved users are added to Kind 30001 Nostr participant lists
6. **Monitor Progress**: View event leaderboards and participant activity

## Technical Architecture

### **Storage Layers**
```
┌─ localStorage (Instant) ─┐    ┌─ Nostr Lists (Official) ─┐
│ • Immediate user joins   │ ←→ │ • Captain-managed        │
│ • Optimistic UI updates  │    │ • Kind 30001 events      │
│ • Offline functionality  │    │ • Permanent record       │
└──────────────────────────┘    └──────────────────────────┘
```

### **Event Kinds Used**
- **Kind 30001**: Official participant lists (captain-managed)
- **Kind 31001**: Join request notifications (to captains)
- **Kind 1301**: Workout activities (for leaderboards)
- **Kind 4**: Direct messages (fallback notifications)

### **Data Flow**
1. User joins event locally (localStorage)
2. Notification sent to captain (Kind 31001)
3. Captain approves request
4. User added to official list (Kind 30001)
5. Leaderboard queries workouts from official participants

## Benefits

### **✅ Instant User Experience**
- No waiting for Nostr event propagation
- Immediate visual feedback on joins
- Works offline and in poor network conditions

### **✅ Captain Control**
- Review all join requests before approval
- Official participant management
- Clear notification system

### **✅ Reliable Architecture**
- localStorage eliminates complex replaceable event issues
- Graceful degradation when Nostr is unavailable
- Follows successful league system patterns

### **✅ Mobile-First Design**
- Optimized for Capacitor mobile apps
- Touch-friendly interfaces
- Background notification support

## Implementation Status

### **✅ Completed**
- [x] EventParticipationService with localStorage joins
- [x] EventNotificationService for captain alerts
- [x] CaptainNotificationsModal UI component
- [x] useEventParticipants hook with notifications
- [x] useEventLeaderboard hook for rankings
- [x] useCaptainNotifications hook for management
- [x] Updated TeamEventDetailPage with captain controls
- [x] Integration testing and build verification

### **🔄 Future Enhancements**
- [ ] Push notifications for join requests (mobile)
- [ ] Bulk participant management
- [ ] Event invitation system
- [ ] Advanced leaderboard filtering
- [ ] Export participant lists
- [ ] Event analytics and reporting

## Testing

The system includes comprehensive test coverage:
- **Unit tests**: Core service functionality
- **Integration tests**: Notification flows
- **Mobile tests**: localStorage behavior
- **UI tests**: Modal interactions

Run tests with:
```bash
npm test
node scripts/test-simplified-events.js
```

## Deployment

System is ready for mobile deployment:
```bash
npm run build:android  # Build and sync to Android
npm run android        # Open in Android Studio
```

The simplified architecture eliminates previous reliability issues and provides a solid foundation for team event management in the mobile app.