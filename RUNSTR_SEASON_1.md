# RUNSTR Season 1 Implementation Plan

## 🎯 Project Overview

Transform the current open RUNSTR League into a premium "RUNSTR Season 1" 3-month distance competition with participant-only access and integrated payment system.

### Core Changes
- **Rebrand**: RUNSTR 500 → RUNSTR Season 1 
- **Competition Model**: 500-mile completion → Most distance in 3 months
- **Access Model**: Open league → Premium participant-only
- **Payment System**: Season pass purchase required
- **Exclusivity**: Feed and leaderboards show only paying participants

---

## 🏗️ Phase 1: Foundation & Branding (Week 1)

### 1.1 Branch Setup & Branding
**Goal**: Create new branch and update all branding references

**Tasks:**
- [ ] Create `RUNSTR_SEASON_1` branch
- [ ] Update all "RUNSTR 500" text to "RUNSTR Season 1"
- [ ] Remove completion percentage logic (no longer 500-mile goal)
- [ ] Update league titles in `src/components/LeagueMap.jsx`

**Files to Modify:**
- `src/components/LeagueMap.jsx`
- `src/hooks/useLeagueLeaderboard.js` 
- `League_Feed.md` (documentation)
- Any other files with "500" references

**Time Estimate:** 4-6 hours

### 1.2 Season Configuration
**Goal**: Create centralized season configuration

**Tasks:**
- [ ] Create `src/config/seasonConfig.js`
- [ ] Define season dates, pricing, and rules
- [ ] Create participant storage structure

**New File Structure:**
```javascript
// src/config/seasonConfig.js
export const SEASON_1_CONFIG = {
  id: "RUNSTR_SEASON_1",
  name: "RUNSTR Season 1",
  description: "3-month distance competition",
  startDate: "2025-02-01T00:00:00Z",
  endDate: "2025-05-01T23:59:59Z", 
  seasonPassPrice: 10000, // sats
  rules: "Most total distance wins",
  // ... other config
};
```

**Time Estimate:** 2-3 hours

---

## 🏗️ Phase 2: Payment Infrastructure (Week 1-2)

### 2.1 Season Pass Service
**Goal**: Create season pass registration and participant tracking

**Tasks:**
- [ ] Create `src/services/seasonPassService.js`
- [ ] Implement participant registration logic
- [ ] LocalStorage for participant status
- [ ] Payment transaction handling

**New Files:**
- `src/services/seasonPassService.js`

**Key Functions:**
```javascript
// Core functions to implement
- registerForSeason(userPubkey)
- isParticipant(userPubkey) 
- getParticipantList()
- getSeasonProgress(userPubkey)
```

**Time Estimate:** 6-8 hours

### 2.2 NWC Wallet Integration
**Goal**: Integrate receive-only NWC wallet for season pass payments

**Tasks:**
- [ ] Create `src/services/seasonWalletService.js`
- [ ] Implement receive-only NWC connection
- [ ] Balance fetching and display logic
- [ ] Error handling for wallet operations

**Integration Points:**
- Leverage existing NWC patterns from `src/services/nwcWallet.js`
- Use existing wallet context patterns
- Connect to payment flow in season pass service

**Time Estimate:** 4-6 hours

---

## 🏗️ Phase 3: UI Components (Week 2)

### 3.1 Banner Enhancement
**Goal**: Add season pass button and wallet balance to app banner

**Tasks:**
- [ ] Identify current banner/header component
- [ ] Add season pass button
- [ ] Add wallet balance display
- [ ] Responsive design for mobile

**Files to Modify:**
- Main header/banner component (need to identify)
- Add styling for new elements

**Design Requirements:**
- Season pass button prominent but not intrusive
- Wallet balance clearly visible
- Mobile-first responsive design

**Time Estimate:** 4-5 hours

### 3.2 Season Pass Modal
**Goal**: Create payment modal for season pass purchase

**Tasks:**
- [ ] Create `src/components/modals/SeasonPassModal.jsx`
- [ ] Season information display
- [ ] Payment form integration
- [ ] Success/error states
- [ ] Participant list preview

**Modal Features:**
- Season details and rules
- Current participant count
- Payment form with NWC integration
- Success confirmation
- Error handling

**Time Estimate:** 6-8 hours

---

## 🏗️ Phase 4: Participant Filtering (Week 2-3)

### 4.1 League Feed Filtering
**Goal**: Filter 1301 workout posts to show only participants

**Tasks:**
- [ ] Modify `src/hooks/useRunFeed.js` 
- [ ] Add participant filtering logic
- [ ] Update feed queries to filter by participant list
- [ ] Maintain existing feed performance

**Files to Modify:**
- `src/hooks/useRunFeed.js`
- `src/pages/RunClub.jsx`

**Implementation Strategy:**
- Check post author against participant list
- Filter during post processing
- Maintain existing caching strategies

**Time Estimate:** 4-6 hours

### 4.2 League Leaderboard Filtering  
**Goal**: Show only participants in league leaderboards

**Tasks:**
- [ ] Modify `src/hooks/useLeagueLeaderboard.js`
- [ ] Filter leaderboard data by participants
- [ ] Update caching to be participant-aware
- [ ] Maintain existing performance

**Files to Modify:**
- `src/hooks/useLeagueLeaderboard.js`
- `src/components/LeagueMap.jsx`

**Implementation Strategy:**
- Filter events by participant pubkeys
- Update cache keys to include participant status
- Maintain separate caches for participants vs all users

**Time Estimate:** 5-7 hours

---

## 🏗️ Phase 5: Competition Logic Updates (Week 3)

### 5.1 Remove Completion Metrics
**Goal**: Remove 500-mile completion logic, focus on distance ranking

**Tasks:**
- [ ] Remove completion percentage displays
- [ ] Update leaderboard to show total distance only
- [ ] Remove "completion" status tracking
- [ ] Update race track visualization

**Files to Modify:**
- `src/components/LeagueMap.jsx`
- `src/hooks/useLeagueLeaderboard.js`
- Any completion percentage components

**Time Estimate:** 3-4 hours

### 5.2 Season Progress Tracking
**Goal**: Track participant progress throughout season

**Tasks:**
- [ ] Implement season-specific distance tracking
- [ ] Time-bounded progress calculations
- [ ] Season leaderboard updates
- [ ] Progress persistence

**New Features:**
- Season start date filtering
- Real-time ranking updates
- Season-specific caching

**Time Estimate:** 4-5 hours

---

## 🏗️ Phase 6: Integration & Testing (Week 3-4)

### 6.1 End-to-End Integration
**Goal**: Connect all components and test complete flow

**Tasks:**
- [ ] Integration testing of payment flow
- [ ] Participant filtering verification
- [ ] Wallet balance updates
- [ ] Error case handling

**Test Scenarios:**
- Season pass purchase flow
- Participant vs non-participant experience
- Payment success/failure states
- Feed and leaderboard filtering

**Time Estimate:** 6-8 hours

### 6.2 Performance Optimization
**Goal**: Ensure system performs well with participant filtering

**Tasks:**
- [ ] Optimize participant list lookups
- [ ] Cache participant status
- [ ] Minimize API calls
- [ ] Loading state improvements

**Time Estimate:** 3-4 hours

---

## 🏗️ Phase 7: Polish & Launch Prep (Week 4)

### 7.1 UI/UX Polish
**Goal**: Final design and usability improvements

**Tasks:**
- [ ] Design consistency review
- [ ] Mobile responsiveness testing
- [ ] Loading states and animations
- [ ] Error message improvements

**Time Estimate:** 4-5 hours

### 7.2 Documentation & Cleanup
**Goal**: Update documentation and clean up code

**Tasks:**
- [ ] Update README with Season 1 info
- [ ] Code cleanup and commenting
- [ ] Remove unused code
- [ ] Create user guide

**Time Estimate:** 2-3 hours

---

## 📋 Key Technical Decisions

### Participant Storage
**Strategy**: LocalStorage + Nostr events for participant tracking
- Fast local lookups for UI performance
- Nostr events for persistence and sync
- Fallback mechanisms for reliability

### Payment Flow
**Strategy**: Leverage existing NWC infrastructure
- Reuse proven payment patterns
- Integrate with existing wallet context
- Maintain security best practices

### Filtering Performance  
**Strategy**: Client-side filtering with smart caching
- Cache participant lists locally
- Filter during data processing
- Minimize impact on existing performance

### Backward Compatibility
**Strategy**: Maintain existing functionality for non-participants
- Non-participants see limited view
- Existing APIs unchanged
- Graceful degradation

---

## 🎯 Success Metrics

### Technical Success
- [ ] Payment flow works reliably
- [ ] Filtering performs well (< 100ms)
- [ ] No breaking changes to existing features
- [ ] Mobile compatibility maintained

### User Experience Success
- [ ] Clear value proposition for season pass
- [ ] Smooth purchase flow
- [ ] Obvious difference between participant/non-participant experience
- [ ] Responsive design works on all devices

### Business Success
- [ ] Season pass conversion tracking
- [ ] Participant engagement metrics
- [ ] Revenue tracking
- [ ] User feedback collection

---

## 🚀 Launch Strategy

### Soft Launch (Week 4)
- Deploy to staging environment
- Internal testing with team
- Bug fixes and refinements

### Beta Launch (Week 5)
- Limited user testing
- Feedback collection
- Final adjustments

### Full Launch (Week 6)
- Production deployment
- Marketing campaign
- User onboarding
- Support preparation

---

## 📚 Dependencies & Requirements

### Existing Infrastructure
- ✅ NWC wallet system
- ✅ Nostr event handling
- ✅ League leaderboard system
- ✅ Feed filtering capabilities
- ✅ Payment modal patterns

### New Requirements
- Season pass pricing decision
- NWC wallet configuration (receive-only)
- Season duration and rules finalization
- Marketing materials

### Technical Requirements
- Nostr relay stability
- LocalStorage for participant data
- Performance monitoring
- Error tracking

---

**Total Estimated Time: 3-4 weeks**  
**Priority: High - foundational feature for monetization**  
**Risk Level: Medium - depends on payment infrastructure reliability** 