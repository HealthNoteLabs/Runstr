# Teams Implementation - NIP101e Fitness Communities

## Current Status

### ✅ Completed
- **Team Creation**: Users can successfully create teams using CreateTeamFormV2
- **Team Listing**: Teams appear on the main teams page
- **NIP101e Integration**: Using Kind 33404 events for team creation

### 🔧 Current Issues
- **Team Detail Page**: Stuck on "loading team details" when clicking a team
- **Missing Team Homepage**: Need to build the actual team dashboard/homepage

## Anticipated User Flow

### 1. Discovery Phase
- User visits `/teams` page
- Sees list of NIP101e-based exercise clubs
- Each team shows: name, description, member count, captain info

### 2. Joining Phase
- User clicks **"Join"** button on a team
- Join action updates their 1301 workout records to include team affiliation
- User gains access to team homepage

### 3. Team Homepage Dashboard
**Primary Screen:**
- Captain's pinned message/description
- List of all team members
- Member activity/stats

**Navigation Tabs:**
- **Events** tab
- **Challenges** tab

### 4. Events Flow
- **Creation**: Captain creates events
- **Participation**: Users click "Participate" on events
- **Integration**: Participation reflected in user's 1301 run records
- **Feed**: Event page shows workout records filtered by event tag

### 5. Challenges Flow  
- **Creation**: Any team member can create challenges
- **Participation**: Users click "Participate" on challenges
- **Integration**: Participation reflected in user's 1301 run records
- **Feed**: Challenge page shows feed of all participants

## Technical Architecture Questions

### NIP101e Integration
1. **Team Membership**: How do we track membership in NIP101e?
   - Add member pubkeys to existing team event?
   - Create separate membership events?
   - Update team event when members join/leave?

2. **1301 Record Integration**: How do we link workouts to teams/events/challenges?
   - What tags do we add to 1301 records?
   - How do we filter feeds by team/event/challenge?

### Data Structure Questions
1. **Team Events (Kind 33404)**:
   - How do we handle member list updates?
   - Should we store member join dates?
   - How do we handle member removal/leaving?

2. **Event Creation**: 
   - What kind should we use for events? (Kind 33405 proposed)
   - How do we link events to teams?
   - How do we track event participation?

3. **Challenge Creation**:
   - What kind should we use for challenges? (Kind 33403 proposed)
   - How do we differentiate from events?
   - How do we handle challenge rules/goals?

## Monetization Structure

### Captain Tier (5k sats/month)
- Administrative control over team
- Create free events
- 50/50 revenue split on member joins
- Captain Nostr Badge
- Ability to pin messages

### Challenge Creator (2k sats/month to maintain)
- Create challenges for team
- Pool money for arbitration (100k sat limit)
- Send funds to RUNSTR for dispute resolution

### Club Members (2k sats/month)
- Participate in events and challenges
- Create challenges (with additional fee)
- Club Member Badge
- Access to team feeds and community

## Technical Implementation Priorities

### Phase 1: Core Team Functionality
1. Fix team detail page loading issue
2. Build team homepage dashboard
3. Implement member list display
4. Add captain message/pinning system

### Phase 2: Membership System
1. Design join/leave team flow
2. Update 1301 records with team affiliation
3. Implement membership tracking
4. Build member management for captains

### Phase 3: Events & Challenges
1. Design event creation system
2. Build challenge creation system
3. Implement participation tracking
4. Create filtered feeds for events/challenges

### Phase 4: Monetization
1. Integrate Lightning payments
2. Implement subscription management
3. Build revenue sharing system
4. Create badge/status system

## Open Questions for Discussion

1. **Team Membership Storage**: Should we store the member list in the team event itself, or create separate membership events for each join/leave action?

2. **1301 Integration**: What's the best way to tag 1301 workout records to show team/event/challenge participation without cluttering the records?

3. **Event vs Challenge Distinction**: How should we differentiate between events (captain-created) and challenges (member-created) in the UI and data structure?

4. **Payment Integration**: How do we want to handle the subscription payments? Monthly automatic? Prepaid credits? Lightning recurring payments?

5. **Team Discovery**: How should users discover teams? Tags? Location-based? Activity type filtering?

6. **Data Persistence**: How do we handle team data when the captain goes offline or stops paying? Should teams have expiration dates?

## Next Steps

1. **Immediate**: Debug and fix team detail page loading
2. **Short-term**: Build basic team homepage with member list
3. **Planning**: Finalize NIP101e extensions for events/challenges
4. **Architecture**: Design membership and participation tracking system

## Analysis – Why the Team Detail Page is still stuck on "Loading"

| Suspected Cause | Evidence/Notes | Quick Check |
|-----------------|----------------|------------|
| 1. `loadTeamDetails` early-returns because `ndkReady` is still `false` when the component mounts | Page shows the *exact* fallback branch: `isLoading && !team` ➜ "Loading team details…" | Add a `console.log(ndkReady)` in the effect or wait a few seconds and see if it flips |
| 2. `fetchTeamById` fails (relay not returning the event) | Would set `error` state and show an error div, **not** the loading one | The fact we never reach the error branch suggests the call is never made |
| 3. The `a`-identifier format in `TeamDetailPage` mismatches what `CreateTeamFormV2` publishes | Would prevent follow-up chat/activity loads but **not** initial team fetch | Low priority for the loading spinner |

**Hypothesis:** The component renders before `ndkReady === true`; the early-return stops the fetch and `isLoading` never flips back because the effect's dependency list requires `ndkReady`.

### Immediate Fix Plan
1. Inside `useEffect` that calls `loadTeamDetails`, ensure it **re-runs** when `ndkReady` becomes `true`.
2. Add a *secondary* `useEffect` that, once `ndkReady` is true and `team` is still `null`, triggers `loadTeamDetails(true)` (forced refetch).
3. Log relay count + `ndkReady` in the UI temporarily to confirm.

---

## Road-map to Finish the Teams Feature (Phase 1 & 2)

| Priority | Feature | Key Tasks | Notes |
|----------|---------|-----------|-------|
| P0 | **Unblock Team Detail Loading** | • Fix `loadTeamDetails` trigger<br>• Verify event filter in `fetchTeamById` | Must show basic team info asap |
| P0 | **Join Button** | • Render when user ≠ captain & not member<br>• Calls `handleJoinTeam` (already coded)<br>• Show state ("Joining…", error) | Depends on wallet connected |
| P1 | **Member List** | • Combine `members` + `extraMembers`<br>• Show avatar/short-pubkey<br>• Show captain badge | Needed for social proof |
| P1 | **Captain Pinned Message** | • Add `pinned_msg` tag to team event<br>• Provide inline edit (captain only) that republishes event | Minimal rich-text for now |
| P1 | **In-App Chat (Team-only)** | • Subscribe to kind `KIND_NIP101_TEAM_CHAT_MESSAGE` filtered by team `a` tag<br>• Simple feed + send box<br>• Re-use `createAndPublishEvent` helper | Text-only MVP |
| P2 | **Events Tab** | • List kind 33403 events with `a` tag to team<br>• Captain can create Event (modal) | Use same LN pay flow for paid events later |
| P2 | **Challenges Tab** | • Same as Events but allow all members to create | Distinguish by `type` field in tags |
| P2 | **Workout Association** | • When user saves a run, if default team set ➜ auto-tag workout record | Logic largely exists in `SaveRunModal` |
| P3 | **Payment UX Polish** | • Replace `alert/confirm` with custom modal<br>• Show invoice & status<br>• Handle failure gracefully | Tied to wallet

---

## Next Coding Steps (Proposed)
1. **Fix loading spinner:** patch the `useEffect` dependencies in `TeamDetailPage` to ensure re-fetch after `ndkReady`.
2. **Render Join Button:** quick UI check, ensure `combinedMembers` logic works.
3. **Display Member List + Captain badge** (read-only).
4. **Add basic Chat Tab** re-using existing event publish helper.

Once these are stable, proceed to Events/Challenges tabs.

---
*Last updated: {{DATE}}*

---

*This document serves as our central reference for the Teams implementation. Update as we make progress and decisions.* 