# NIP-101h Takeover: Building Decentralized Fitness Communities on RUNSTR

## Vision Statement
Transform RUNSTR into a fully decentralized fitness community platform by deeply integrating NIP-101h (health metrics) and NIP-101e (exercise tracking) standards, enabling users to form teams, participate in challenges, and organize events - all on the Nostr protocol.

## Core Implementation Changes

### 1. Feed Transformation
**Current State**: Shows Kind 1 notes (general Nostr posts)

**New Implementation**: 
- Display only Kind 1301 workout records
- Filter by activity type based on current mode:
  - **Running Mode**: Show latest 10 running workout records
  - **Walking Mode**: Show latest 10 walking workout records  
  - **Cycling Mode**: Show latest 10 cycling workout records
- Sort by timestamp (most recent first)
- Add zapping functionality to each workout record
- Remove all Kind 1 note functionality from feed

### 2. Teams Reimplementation
**Current State**: Uses NIP-29 groups protocol

**New Implementation**:
- Replace NIP-29 with Kind 33404 (Fitness Teams)
- Teams page shows all RUNSTR-associated fitness teams
- Team creation flow (with payment gate in future)
- Team joining flow (with payment gate in future)
- Team detail pages showing:
  - Member list with profile info
  - Team information and stats
  - Member workout records (Kind 1301)
  - Team events section (Kind 33405)

## Core Concepts

### 1. Feed Specification
```typescript
// Feed filtering logic
interface FeedFilter {
  kind: 1301 // Only workout records
  tags: {
    activity_type: 'running' | 'walking' | 'cycling' // Based on current mode
  }
  limit: 10
  sort: 'created_at DESC'
}

// Workout record display
interface WorkoutCard {
  author: Profile
  activity: ActivityData
  stats: WorkoutStats
  zapButton: boolean
  timestamp: Date
}
```

### 2. Teams Architecture
```typescript
// Team discovery
interface TeamDiscovery {
  getAllTeams(): Promise<Team[]> // All Kind 33404 with RUNSTR tag
  createTeam(data: TeamData): Promise<Event> // Create Kind 33404
  joinTeam(teamId: string): Promise<void> // Add user as member
}

// Team page components
interface TeamPage {
  teamInfo: TeamHeader
  membersList: Member[]
  workoutFeed: WorkoutRecord[] // Filtered by team members
  eventsSection: FitnessEvent[] // Kind 33405 events
}
```

### 3. Events & Challenges
- **Events**: Organized races, group runs, virtual competitions
- **Challenges**: Time-based goals (e.g., "100 miles in 30 days")
- **Entry Fees**: Sats to create/join with percentage to organizers
- **Verification**: GPS data and device info for integrity

## Proposed NIP Extensions

### New Event Kinds

#### Kind 33403 - Fitness Challenge
```json
{
  "kind": 33403,
  "content": "Challenge description and rules",
  "tags": [
    ["d", "<challenge-uuid>"],
    ["name", "Challenge Name"],
    ["start", "<timestamp>"],
    ["end", "<timestamp>"],
    ["goal_type", "distance_total|time_total|frequency|custom"],
    ["goal_value", "<value>", "<unit>"],
    ["activity_types", "running", "cycling", "walking"],
    ["rules", "Detailed rules"],
    ["entry_fee", "<sats>"],
    ["prize_pool", "<sats>"],
    ["public", "true|false"],
    ["t", "challenge"],
    ["t", "<activity-type>"]
  ]
}
```

#### Kind 33404 - Fitness Team
```json
{
  "kind": 33404,
  "content": "Team description and mission",
  "tags": [
    ["d", "<team-uuid>"],
    ["name", "Team Name"],
    ["type", "running_club|cycling_team|fitness_group|custom"],
    ["location", "City, State/Country"],
    ["captain", "<pubkey>"],
    ["member", "<pubkey>"], // repeated for each member
    ["public", "true|false"],
    ["membership_fee", "<sats>", "monthly|yearly|one-time"],
    ["t", "team"],
    ["t", "<activity-type>"]
  ]
}
```

#### Kind 33405 - Fitness Event
```json
{
  "kind": 33405,
  "content": "Event details and description",
  "tags": [
    ["d", "<event-uuid>"],
    ["name", "Event Name"],
    ["date", "<timestamp>"],
    ["location", "Venue/City"],
    ["event_type", "race|group_run|virtual|meetup"],
    ["distance", "<value>", "<unit>"],
    ["registration_deadline", "<timestamp>"],
    ["registration_fee", "<sats>"],
    ["max_participants", "<number>"],
    ["organizer", "<pubkey>"],
    ["t", "event"],
    ["t", "<activity-type>"]
  ]
}
```

### Enhanced Kind 1301 (Workout Record)
Add community linking tags:
```json
{
  "kind": 1301,
  "tags": [
    // Existing workout data...
    
    // Community connections
    ["challenge", "33403:<pubkey>:<challenge-uuid>", "<relay>"],
    ["team", "33404:<pubkey>:<team-uuid>", "<relay>"],
    ["event", "33405:<pubkey>:<event-uuid>", "<relay>"],
    
    // Progress tracking
    ["challenge_progress", "<challenge-id>", "<current>", "<unit>", "<percentage>"],
    ["team_contribution", "<team-id>", "<value>", "<unit>", "<period>"]
  ]
}
```

## Implementation Phases

### Phase 1: Feed Overhaul (Week 1)
- [x] Remove Kind 1 note functionality from feed
- [ ] Implement Kind 1301 workout record fetching
- [ ] Add activity type filtering based on mode
- [ ] Display latest 10 records per activity type
- [ ] Add zapping to workout records
- [ ] Update feed UI for workout-specific display

### Phase 2: Teams Migration (Week 2-3)
- [ ] Remove NIP-29 implementation
- [ ] Implement Kind 33404 team creation
- [ ] Build team discovery page
- [ ] Create team detail pages
- [ ] Add member management
- [ ] Implement team workout feed
- [ ] Add events section to team pages

### Phase 3: Integration (Week 4)
- [ ] Connect workout records to teams (team tags)
- [ ] Ensure feed respects privacy settings
- [ ] Add team badges to workout cards
- [ ] Implement team statistics
- [ ] Test cross-functionality

### Phase 4: Challenges (Weeks 5-6)
- [ ] Implement Kind 33403 for challenges
- [ ] Challenge creation flow with goals
- [ ] Progress tracking system
- [ ] Leaderboards and rankings
- [ ] Challenge completion verification

### Phase 5: Events (Weeks 7-8)
- [ ] Implement Kind 33405 for events
- [ ] Event creation and management
- [ ] Registration system with sats
- [ ] Event results and reporting
- [ ] Virtual event support

### Phase 6: Integration & Polish (Weeks 9-10)
- [ ] NIP-101h metrics integration
- [ ] Advanced analytics and insights
- [ ] Achievement system
- [ ] Performance optimizations
- [ ] UI/UX refinements

## Technical Architecture

### Data Flow
1. **Feed Query**: 
   - Query relays for Kind 1301 events
   - Filter by activity_type tag matching current mode
   - Limit to 10 most recent
   - Display with zap functionality

2. **Teams Flow**:
   - Query relays for Kind 33404 with RUNSTR tags
   - Display available teams
   - Join team = update Kind 33404 member list
   - Team feed = Kind 1301 filtered by team member pubkeys

### Key Components

#### 1. NostrService Updates
```typescript
// Feed methods
interface FeedMethods {
  getWorkoutsByActivity(activity: 'running' | 'walking' | 'cycling', limit: number): Promise<WorkoutRecord[]>
  zapWorkout(eventId: string, amount: number): Promise<void>
}

// Teams methods (replacing NIP-29)
interface TeamMethods {
  // Discovery
  getRunstrTeams(): Promise<Team[]>
  getTeamById(teamId: string): Promise<Team>
  
  // Management
  createTeam(teamData: TeamData): Promise<Event>
  joinTeam(teamId: string): Promise<void>
  leaveTeam(teamId: string): Promise<void>
  
  // Team data
  getTeamMembers(teamId: string): Promise<Profile[]>
  getTeamWorkouts(teamId: string): Promise<WorkoutRecord[]>
  getTeamEvents(teamId: string): Promise<FitnessEvent[]>
}
```

#### 2. State Management Updates
```typescript
interface AppState {
  // Updated feed state
  feed: {
    workouts: WorkoutRecord[]
    loading: boolean
    activityFilter: 'running' | 'walking' | 'cycling'
    lastFetch: timestamp
  }
  
  // New teams state (replacing NIP-29)
  teams: {
    allTeams: Team[]
    userTeams: Team[]
    currentTeam?: Team
    teamMembers: Map<string, Profile[]>
    teamWorkouts: Map<string, WorkoutRecord[]>
  }
}
```

### Migration Strategy

#### From Kind 1 to Kind 1301 Feed
1. Update relay subscriptions to filter Kind 1301 only
2. Parse workout-specific tags (activity_type, duration, distance)
3. Create new UI components for workout display
4. Implement zapping on workout events
5. Remove all Kind 1 handling code

#### From NIP-29 to Kind 33404 Teams
1. Map existing NIP-29 groups to Kind 33404 format
2. Migrate member lists to new tag structure
3. Update UI to show fitness-specific team features
4. Add workout feed filtered by team members
5. Implement events section for Kind 33405

### UI/UX Updates

#### Feed Design
```
┌─────────────────────────────┐
│  [Run] [Walk] [Cycle]       │ <- Activity mode selector
├─────────────────────────────┤
│  Recent Activities          │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ @user123 • 2 hours ago  │ │
│ │ 🏃 5.2 km in 28:30      │ │
│ │ ❤️ 165 bpm avg          │ │
│ │ 📍 Central Park         │ │
│ │ [⚡ Zap] [💬] [🔁]      │ │
│ └─────────────────────────┘ │
│          ...                │
└─────────────────────────────┘
```

#### Teams Page Design
```
┌─────────────────────────────┐
│      RUNSTR Teams           │
├─────────────────────────────┤
│ [+ Create Team]             │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ NYC Runners Club        │ │
│ │ 👥 156 members          │ │
│ │ 📍 New York, NY         │ │
│ │ [Join Team]             │ │
│ └─────────────────────────┘ │
│          ...                │
└─────────────────────────────┘
```

## Monetization & Incentives

### Sats Flow
1. **Team Creation**: Optional fee to prevent spam
2. **Team Membership**: Optional monthly/yearly fees
3. **Challenge Entry**: Entry fees create prize pools
4. **Event Registration**: Fees go to organizers
5. **Workout Zaps**: Direct support between users

### Distribution Model
- Challenge winners split prize pool
- Event organizers keep registration fees (minus network fee)
- Team captains can set membership fees
- Platform takes small percentage for relay costs

## Privacy & Security

### Options
- Private teams (invite-only)
- Private challenges (unlisted)
- Optional location sharing
- Encrypted team communications
- Granular privacy settings per workout

### Verification
- GPS polyline for outdoor activities
- Device attestation
- Photo proof options
- Community verification (team vouching)

## Success Metrics

### User Engagement
- Daily active users
- Workouts posted per day
- Team participation rate
- Challenge completion rate
- Zap volume

### Community Health
- Number of active teams
- Average team size
- Challenge diversity
- Event attendance
- User retention

## Open Questions

1. **Activity Detection**: How to determine activity_type for Kind 1301 filtering?
   - Parse tags? Check content field? Use standardized tag format?

2. **Team Association**: How to link teams to RUNSTR specifically?
   - Use a specific tag like ["client", "runstr"]?
   - Create a RUNSTR relay for team discovery?

3. **Payment Integration**: When to add payment gates?
   - Phase 1: Free creation/joining
   - Phase 2: Add Lightning payments

4. **Data Migration**: How to handle existing NIP-29 teams?
   - One-time migration script?
   - Dual support period?
   - Clean break?

## Next Steps

1. **Community Feedback**: Share proposal with Nostr/fitness communities
2. **NIP Draft**: Formalize extensions to NIP-101e
3. **Prototype**: Build MVP of team functionality
4. **Testing**: Beta test with small group
5. **Iterate**: Refine based on feedback

## References

- [NIP-101h Health Profile Framework](https://github.com/HealthNoteLabs/Modular-Health-NIPs/blob/main/NIP101h)
- [NIP-101e Exercise Tracking](#) (needs link when published)
- [Nostr Protocol](https://nostr.com)
- [RUNSTR App](https://github.com/SamSamskies/runstr)

---

*This document is a living brainstorm and will evolve as we refine the implementation.* 