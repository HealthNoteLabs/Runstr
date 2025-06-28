# RUNSTR Season 1 Subscription Implementation Tracker

## 🎯 **Season 1 Vision**
RUNSTR Season 1 is a 3-month competitive event (July 4 - October 4, 2025) that creates a premium experience for subscribers. It features distance-based leaderboards, team functionality, and a growing prize pool funded by subscription fees.

### Core Features:
- **Duration**: 3 months (July 4 - Oct 4, 2025)
- **Competition**: Distance-based leaderboard by activity type
- **Subscription Tiers**: Captain (10k sats) / Member (5k sats)
- **Team System**: Captains create teams, Members join
- **Prize Pool**: Funded by subscription fees, displayed in real-time
- **Filtered Feed**: Only kind 1301 notes from subscribers
- **Location**: Dedicated League tab

---

## ✅ **IMPLEMENTED COMPONENTS**

### 1. Subscription System - **COMPLETE**
- [x] **Payment Collection**: NWC string configured in `rewardsConfig.ts`
- [x] **Tiers**: Captain (10k sats) / Member (5k sats) pricing
- [x] **Invoice Generation**: `subscriptionService.ts` handles payments
- [x] **Payment Verification**: Monitors payments and creates receipts
- [x] **Receipt System**: Kind events for subscription tracking
- [x] **UI Component**: `Season1SubscriptionCard.jsx` for payments
- [x] **Status Tracking**: `useSeasonSubscription.ts` hook
- [x] **Service Layer**: `season1SubscriptionService.ts` manages subscribers

### 2. Feed Filtering Infrastructure - **COMPLETE**
- [x] **Subscriber Detection**: `useLeagueRunFeed.ts` identifies subscribers
- [x] **Feed Separation**: Toggle between "All Runners" vs "Season 1 Participants"
- [x] **UI Toggle**: Implemented in `RunClub.jsx`
- [x] **Subscriber Stats**: Shows subscriber/captain counts
- [x] **Performance**: Cached subscriber lists with 5-minute refresh
- [x] **Activity Mode Filtering**: Integrated activity mode filtering in participant feed
- [x] **Kind 1301 Filtering**: Inherits from `useRunFeed('RUNSTR')` for workout-only events

### 3. Teams Foundation - **EXISTS BUT NOT INTEGRATED**
- [x] **Team Creation**: `NostrTeamsService.ts` with full CRUD
- [x] **Team Forms**: `CreateTeamForm.tsx` components
- [x] **Team Receipts**: Subscription verification system
- [x] **Team Activity Feed**: `fetchTeamActivityFeed()` for kind 1301 filtering

### 4. Rewards Pool Display - **COMPLETE** ✅
- [x] **Wallet Balance Hook**: `useSubscriptionWalletBalance.ts` with 30-second polling
- [x] **Balance Display Component**: `RewardsPoolDisplay.jsx` shows growing prize pool
- [x] **Real-time Updates**: Monitors NWC wallet balance with auto-refresh
- [x] **Prize Distribution**: Shows 1st/2nd/3rd place amounts (50%/30%/20%)
- [x] **UI Integration**: Positioned above LeagueMap with matching styling

---

## ❌ **MISSING COMPONENTS**

### 1. League Tab Structure - **EXISTS** ✅
- [x] **Dedicated League Tab**: Already exists with LeagueMap component
- [x] **Competition Infrastructure**: RUNSTR 500 system with activity filtering
- [x] **Race Track Visualization**: Linear track with user positions
- [x] **Activity Mode Filtering**: Run/Walk/Cycle modes already implemented

### 2. Season 1 Competition Modifications - **NEEDS UPDATES**
- [ ] **Replace RUNSTR 500**: Change "THE RUNSTR 500" to "RUNSTR Season 1"
- [ ] **Subscriber Filtering**: Add subscription-only filtering to existing leaderboard
- [ ] **Season Period**: Modify distance tracking for 3-month season period
- [ ] **Competition Goal**: Update from 500-mile goal to Season 1 format
- [ ] **Existing Leaderboard**: ✅ Already exists in `LeagueMap.jsx`
- [ ] **Existing Activity Filtering**: ✅ Already supports Run/Walk/Cycle modes

### 3. Team Integration with Subscriptions - **MISSING**
- [ ] **Captain Verification**: Only Captains can create teams
- [ ] **Member Team Joining**: Members can join but not create
- [ ] **Subscription Gate**: Team features require active subscription
- [ ] **Team Leaderboards**: Team-based competition within Season 1

### 4. Kind 1301 Specific Filtering - **COMPLETE**
- [x] **Event Type Filtering**: Inherited from `useRunFeed('RUNSTR')` which filters for RUNSTR workout events
- [x] **Workout-Only Feed**: Ensures only kind 1301 (run activities) appear in participant feed
- [x] **Activity Type Support**: Filters by run/cycle/walk modes using activity matching logic

---

## 🏗️ **IMPLEMENTATION PLAN**

### **Phase 1: Fix Feed Filtering** (Priority: HIGH) ✅ **COMPLETE**
**Goal**: Ensure participant feed only shows kind 1301 workout notes from subscribers with activity mode filtering
- [x] **Activity Mode Integration**: Added `useActivityMode` import to `useLeagueRunFeed.ts`
- [x] **Enhanced Filtering**: Updated `participantPosts()` to filter by subscription status AND activity mode
- [x] **Consistent Logic**: Applied same activity matching logic from `useRunFeed.js` (run/running/jog, cycle/cycling/bike, walk/walking/hike)
- [x] **Kind 1301 Validation**: Inherited from underlying `useRunFeed('RUNSTR')` which already filters for RUNSTR workout events
- [x] **Fallback Handling**: Allows events without exercise tags (same as existing logic)

**Implementation Details**:
- ✅ `participantPosts()` now applies dual filtering: subscriber status first, then activity mode
- ✅ Uses existing activity matching map for consistent behavior across the app
- ✅ Maintains console logging for debugging filtered events
- ✅ Preserves all existing subscription and caching functionality

**Files Modified**:
- ✅ `src/hooks/useLeagueRunFeed.ts` - Added activity mode filtering

### **Phase 2: Add Wallet Balance Monitoring** (Priority: HIGH) ✅ **COMPLETE**
**Goal**: Display growing rewards pool from subscription payments
- [x] **Multi-Wallet Balance Hook**: `useSubscriptionWalletBalance.ts` with 30-second polling for all 3 wallets
- [x] **3-Wallet Display Component**: `RewardsPoolDisplay.jsx` shows Prize Pool, Open Sats, and App Development
- [x] **Real-time Updates**: Automatic polling every 30 seconds with manual refresh option for all wallets
- [x] **Prize Distribution**: Shows 1st/2nd/3rd place amounts (50%/30%/20% split) from prize pool
- [x] **Split Configuration**: External wallet splits automatically distribute funds to Open Sats and App Dev
- [x] **UI Integration**: Added above LeagueMap in RunClub.jsx with responsive 3-column grid
- [x] **Error Handling**: Graceful degradation with individual wallet error states
- [x] **Styling**: Matches minimalistic black/white design with semantic wallet icons

**Implementation Details**:
- ✅ `useSubscriptionWalletBalance.ts` polls all 3 NWC wallets simultaneously via Promise.all
- ✅ `RewardsPoolDisplay.jsx` displays 3-wallet grid (Prize Pool 🏆, Open Sats 🎯, App Dev ⚡) 
- ✅ Individual wallet error handling with visual indicators
- ✅ Responsive grid layout (1 column mobile, 3 columns desktop)
- ✅ Prize distribution section only shows for prize pool balance
- ✅ Auto-refresh every 30 seconds plus manual refresh button
- ✅ Shows funding growth indicator and competition end date

**Wallet Configuration**:
- ✅ Prize Pool: Primary subscription collection wallet
- ✅ Open Sats: Community funding for open source development 
- ✅ App Development: RUNSTR app development and maintenance funding
- ✅ External split configuration routes portions to Open Sats and App Dev automatically

**Files Created**:
- ✅ `src/hooks/useSubscriptionWalletBalance.ts` - Multi-wallet balance monitoring
- ✅ `src/components/RewardsPoolDisplay.jsx` - 3-wallet display component

**Files Modified**:
- ✅ `src/config/rewardsConfig.ts` - Added openSatsNwcUri and appDevNwcUri
- ✅ `src/pages/RunClub.jsx` - Added RewardsPoolDisplay component

### **Phase 3: Modify Existing Competition to Season 1** (Priority: MEDIUM)
**Goal**: Convert RUNSTR 500 to RUNSTR Season 1 with subscription filtering
- [ ] Update `LeagueMap.jsx` to show "RUNSTR Season 1" instead of "THE RUNSTR 500"
- [ ] Add subscription filtering to existing `useLeagueLeaderboard.js` hook
- [ ] Modify distance goal from 500 miles to Season 1 format (3-month period)
- [ ] Integrate subscriber-only filtering into existing leaderboard
- [ ] Add Season 1 branding and prize pool indicators
- [ ] Update race track visualization for Season 1 theme

**Files to Modify** (NOT create):
- `src/components/LeagueMap.jsx` (existing competition component)
- `src/hooks/useLeagueLeaderboard.js` (add subscription filtering)
- `src/pages/RunClub.jsx` (integrate subscription data)

### **Phase 4: Team Integration** (Priority: LOW)
**Goal**: Connect team functionality with subscription tiers
- [ ] Add subscription tier validation to team creation
- [ ] Update `CreateTeamForm` to check Captain status
- [ ] Enable team joining for Members
- [ ] Add team leaderboards within Season 1
- [ ] Update team components with subscription gates

**Files to Modify**:
- `src/components/teams/CreateTeamForm.tsx`
- `src/services/nostr/NostrTeamsService.ts`
- `src/hooks/useTeamSubscriptionStatus.ts`

---

## 🔧 **TECHNICAL SPECIFICATIONS**

### Season 1 Configuration (COMPLETE)
```typescript
// From src/config/rewardsConfig.ts
SEASON_1: {
  identifier: 'runstr-season-1-2025',
  startDate: '2025-07-04T00:00:00Z', // July 4th start
  endDate: '2025-10-04T23:59:59Z', // 3 months later
  memberFee: 5000, // 5,000 sats for members
  captainFee: 10000, // 10,000 sats for captains
  subscriptionNwcUri: 'nostr+walletconnect://...', // NWC URI for collection
  prizePool: {
    first: 50000, // 50k sats for 1st place
    second: 30000, // 30k sats for 2nd place  
    third: 20000, // 20k sats for 3rd place
  }
}
```

### Subscription Service Architecture (COMPLETE)
- **Payment Flow**: Invoice generation → Payment → Verification → Receipt
- **NWC Integration**: Direct wallet connection for fee collection
- **Receipt System**: Nostr events for subscription proof
- **Caching**: 5-minute refresh cycles for subscriber lists

### Feed Architecture (NEEDS UPDATES)
- **Current**: Filters by pubkey but includes all event types
- **Target**: Filter by pubkey AND kind 1301 (workout events only)
- **Activity Support**: Run/Cycle/Walk mode filtering

### Leaderboard Requirements (NOT IMPLEMENTED)
- **Distance Calculation**: Sum of distances within season period
- **Activity Types**: Separate leaderboards for run/cycle/walk
- **Subscriber Filter**: Only show users with active subscriptions
- **Real-time**: Update as new workouts are posted
- **Prize Indicators**: Show 1st/2nd/3rd place rewards

---

## 🧪 **TESTING CHECKLIST**

### Pre-Implementation Testing
- [x] **Subscription Payments**: Verified invoice generation and payment
- [x] **Receipt Creation**: Confirmed subscription receipts are created
- [x] **Subscriber Detection**: Verified subscriber filtering works
- [x] **Feed Toggle**: Confirmed All vs Participants toggle works

### Phase 1 Testing (Feed Filtering) - **READY FOR TESTING**
- [x] **Implementation Complete**: Activity mode filtering integrated into participant feed
- [ ] **Kind 1301 Only**: Verify only workout events show in participant feed
- [ ] **Mixed Content**: Test with social posts + workouts in feed
- [ ] **Activity Filtering**: Confirm run/cycle/walk filtering works
- [ ] **Subscriber Status**: Verify non-subscribers excluded correctly

### Phase 2 Testing (Wallet Balance) - **READY FOR TESTING**
- [x] **Implementation Complete**: Multi-wallet display component integrated above LeagueMap
- [ ] **3-Wallet Balance Polling**: Confirm all 3 wallet balances update correctly every 30 seconds
- [ ] **Payment Reflection**: New subscriptions increase all relevant wallet balances in real-time
- [ ] **Individual Error Handling**: Verify graceful handling when individual wallets are unavailable
- [ ] **Performance**: No excessive API calls to any wallet
- [ ] **UI Consistency**: Verify styling matches existing minimalistic design
- [ ] **Prize Distribution**: Verify 50%/30%/20% split calculations display correctly for prize pool only
- [ ] **Responsive Layout**: Test 3-wallet grid on mobile vs desktop layouts

### Phase 3 Testing (Leaderboard)
- [ ] **Distance Calculation**: Verify accurate distance totals
- [ ] **Season Period**: Only activities within July 4 - Oct 4 counted
- [ ] **Subscriber Filter**: Non-subscribers excluded from leaderboard
- [ ] **Activity Types**: Separate rankings for run/cycle/walk
- [ ] **Real-time Updates**: New activities update rankings immediately

### Phase 4 Testing (Team Integration)
- [ ] **Captain Gates**: Only Captains can create teams
- [ ] **Member Joining**: Members can join but not create teams
- [ ] **Subscription Expiry**: Expired subscriptions lose team access
- [ ] **Team Leaderboards**: Team-based distance competitions

---

## 📊 **SUCCESS METRICS**

### User Experience Metrics
- **Subscription Conversion**: % of users who subscribe after viewing Season 1
- **Feed Engagement**: Interaction rates on participant-only feed
- **Competition Participation**: Active users posting workouts
- **Team Formation**: Captains creating teams, Members joining

### Technical Metrics
- **Payment Success Rate**: % of subscription payments that complete
- **Feed Performance**: Load times for filtered feeds
- **Real-time Updates**: Latency for leaderboard/balance updates
- **Error Rates**: System stability during high usage

### Business Metrics
- **Revenue Growth**: Total sats collected via subscriptions
- **Retention Rate**: Users maintaining active subscriptions
- **Competition Completion**: Users active through full 3-month season
- **Feature Adoption**: Usage of team functionality by subscribers

---

## 🐛 **KNOWN ISSUES & CONSIDERATIONS**

### Current Issues
1. **Feed Filtering**: Currently shows all event types, not just workouts
2. **No Prize Pool Display**: Users can't see growing rewards pool
3. **Competition Branding**: Shows "RUNSTR 500" instead of "Season 1"
4. **Team Integration**: Subscription tiers not enforced for teams
5. **Subscriber Filtering**: LeagueMap shows all users instead of subscribers only

### Design Considerations
1. **Mobile First**: All components must work well on mobile
2. **Performance**: Large subscriber lists need efficient filtering
3. **Real-time**: Balance and leaderboard updates should feel live
4. **Error Handling**: Graceful degradation when services unavailable

### Future Enhancements
1. **Multi-Season Support**: Architecture for Season 2, 3, etc.
2. **Advanced Analytics**: Detailed statistics for subscribers
3. **Social Features**: Team chat, challenges, etc.
4. **Gamification**: Badges, achievements, streaks for subscribers

---

## 📝 **PROGRESS TRACKING**

### Completed (✅)
- Subscription payment system
- Subscriber detection and caching
- Feed filtering infrastructure with activity mode support
- Kind 1301 workout event filtering
- **Wallet balance monitoring and rewards pool display**
- Team creation foundations
- Season 1 configuration

### In Progress (🚧)
- *Phase 2 Testing and Validation*

### Next Up (📋)
1. **Phase 3**: Season 1 distance leaderboard with subscriber filtering
2. **Phase 4**: Team integration

### Blocked/Deferred (⏸️)
- Team integration (waiting for core features)

---

**Last Updated**: January 2025  
**Status**: Phase 2 Complete - Ready for Phase 3 (Season 1 Competition Modifications)  
**Priority**: Test Phase 2 implementation, then implement Season 1 leaderboard modifications 