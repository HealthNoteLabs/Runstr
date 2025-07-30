# Team Events Enhancement - League-Style Implementation

## Overview
Transform team events to match the league tab functionality, creating a unified experience where team captains can create events that function similarly to the main league, with participation tracking, leaderboards, and activity feeds.

## Key Requirements
1. **Explicit Participation**: Team members must explicitly join events (future: pay for tickets)
2. **Full Leaderboard**: Show ALL participants, even with 0 distance
3. **Activity Feed**: Display kind 1301 workout records from event participants only
4. **Black/White Theme**: Match the minimalist dashboard aesthetic
5. **Full Page Experience**: Convert from modal to dedicated page

## Architecture

### Event Flow
1. Captain creates event with details (distance, date, activity type)
2. Team members view event and click "Join Event" 
3. Participants are tracked separately from completions
4. During event period, participants' kind 1301 activities are displayed
5. Leaderboard shows all participants with their progress

### Data Structure
```javascript
// Event Participation (new kind: 33409)
{
  kind: 33409,
  content: "Joined team event",
  tags: [
    ["d", eventId],
    ["a", teamAIdentifier],
    ["e", eventId],
    ["p", captainPubkey]
  ]
}

// Workout Record (existing kind: 1301) with event tag
{
  kind: 1301,
  content: "Completed workout",
  tags: [
    // ... existing tags
    ["event", eventId],
    ["team", teamAIdentifier]
  ]
}
```

## Implementation Phases

### Phase 1: Core Infrastructure & Event Participation
**Status: In Progress**

#### 1.1 Event Participation System
- [ ] Create `joinTeamEvent` function in NostrTeamsService
- [ ] Create `leaveTeamEvent` function for withdrawals
- [ ] Add KIND_EVENT_PARTICIPATION = 33409
- [ ] Fetch participation list separately from activities
- [ ] Update event state to track participants

#### 1.2 Route Infrastructure
- [ ] Create route: `/teams/:captainPubkey/:teamUUID/event/:eventId`
- [ ] Create EventDetailPage component
- [ ] Update navigation from modal to page
- [ ] Add back navigation to team page

#### 1.3 Fix Immediate Issues
- [ ] Fix date/time confusion - properly handle today's events
- [ ] Fix leaderboard loading in current modal
- [ ] Add "km" label to custom distance input
- [ ] Remove emoji icons (🏃 🚶 🚴) - use text labels

### Phase 2: League-Style Leaderboard
**Status: Planned**

#### 2.1 Leaderboard Structure
- [ ] Header: "X Event Participants" count
- [ ] Show ALL participants who joined
- [ ] Display 0km for inactive participants
- [ ] Implement ranking algorithm

#### 2.2 Leaderboard UI (matching LeagueMap)
- [ ] Rank badges (gold/silver/bronze/gray)
- [ ] Participant profiles with pictures
- [ ] Activity count display
- [ ] "YOU" badge for current user
- [ ] Progress indicators

### Phase 3: Activity Feed Integration
**Status: Planned**

#### 3.1 Feed Data Fetching
- [ ] Query kind 1301 with event tags
- [ ] Filter by participant list
- [ ] Apply date range filtering
- [ ] Sort by recency

#### 3.2 Feed Display
- [ ] Reuse Post/WorkoutCard components
- [ ] Display below leaderboard
- [ ] Show participant profiles
- [ ] Activity-specific formatting

### Phase 4: UI Polish - Black/White Theme
**Status: Planned**

#### 4.1 Remove Colors
- [ ] Replace all emoji icons with text
- [ ] Remove color status indicators
- [ ] Use only black/white/gray palette

#### 4.2 Consistent Styling
- [ ] Black buttons with white borders
- [ ] Gray backgrounds (bg-gray-800/900)
- [ ] White text throughout
- [ ] Hover: white bg, black text

#### 4.3 Component Updates
- [ ] TeamEventsTab styling
- [ ] CreateEventModal styling
- [ ] EventDetailPage styling
- [ ] Event cards matching DashboardRunCard

### Phase 5: Enhanced Features
**Status: Future**

#### 5.1 Event Management
- [ ] Countdown timers
- [ ] Event statistics dashboard
- [ ] Completion certificates
- [ ] Share functionality

#### 5.2 Monetization Ready
- [ ] Event ticket pricing
- [ ] Payment integration hooks
- [ ] Prize pool management
- [ ] Payout distribution

## Component Structure

### EventDetailPage Layout
```
┌─────────────────────────────────────┐
│ < Back to Team                      │
├─────────────────────────────────────┤
│ Event Name                          │
│ 5km Run • Dec 15, 2024              │
│ [Join Event] / [Participating ✓]    │
├─────────────────────────────────────┤
│ 25 Event Participants               │
├─────────────────────────────────────┤
│ 🏆 Event Leaderboard                │
│ ┌─────────────────────────────────┐ │
│ │ 1  Runner123  3 runs  15.2km   │ │
│ │ 2  Walker456  2 runs  10.1km   │ │
│ │ 3  You        1 run   5.0km    │ │
│ │ 4  Cyclist789 0 runs  0.0km    │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Recent Activity                     │
│ ┌─────────────────────────────────┐ │
│ │ WorkoutCard                     │ │
│ │ WorkoutCard                     │ │
│ │ WorkoutCard                     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## API Functions

### NostrTeamsService Additions
```typescript
// Join an event
export async function joinTeamEvent(
  ndk: NDK,
  eventId: string,
  teamAIdentifier: string,
  captainPubkey: string
): Promise<NDKEvent>

// Leave an event  
export async function leaveTeamEvent(
  ndk: NDK,
  eventId: string,
  teamAIdentifier: string
): Promise<boolean>

// Fetch event participants
export async function fetchEventParticipants(
  ndk: NDK,
  eventId: string,
  teamAIdentifier: string
): Promise<string[]> // Array of pubkeys

// Fetch event activities (kind 1301)
export async function fetchEventActivities(
  ndk: NDK,
  eventId: string,
  teamAIdentifier: string,
  participantPubkeys: string[],
  startDate: string,
  endDate: string
): Promise<NDKEvent[]>
```

## Testing Checklist

### Phase 1 Testing
- [ ] User can join an event
- [ ] Join status persists across reloads
- [ ] Multiple users can join same event
- [ ] Event page loads correctly
- [ ] Navigation works both ways
- [ ] Date/time displays correctly
- [ ] Custom distance shows km unit

### Integration Testing
- [ ] Events work across different teams
- [ ] Leaderboard updates in real-time
- [ ] Activities appear in feed
- [ ] Profile pictures load correctly
- [ ] Mobile responsiveness

## Migration Notes
- Existing events will need participation data migration
- Consider backwards compatibility for old event format
- Ensure smooth transition from modal to page

## Future Considerations
1. **Event Templates**: Quick creation of recurring events
2. **Virtual Races**: GPS-tracked routes with checkpoints  
3. **Team vs Team**: Inter-team competition events
4. **Achievements**: Event-specific badges and rewards
5. **Export Results**: CSV/PDF event summaries