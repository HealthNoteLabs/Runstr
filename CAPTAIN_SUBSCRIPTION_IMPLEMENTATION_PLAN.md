# Captain Subscription & Event Prize Pool Implementation Plan

**Target**: Two-tier subscription system with team-based economy and prize pool events  
**Timeline**: 3 weeks phased implementation  
**Risk Level**: LOW - Extends existing infrastructure  

## System Overview

### Subscription Tiers
- **Member**: 5k sats/month → Join teams, receive daily rewards
- **Captain**: 10k sats/month → Create teams, team rewards, prize pool events

### Team Economy
- Users can only be on ONE team at a time (default posting team)
- Team selection during subscription flow
- Captains earn weekly rewards based on team size
- Captains can create events with prize pools

### Prize Pool System
- Captains add optional prize money to events
- Winners determined by existing event logic
- Captains manually distribute prizes to winners

---

## Phase 1: Subscription Tier System ⏳
**Timeline**: Week 1  
**Status**: 🔄 Not Started

### 1.1 Extend Subscription Data Structure
- [ ] **Update `MonthlySubscriptionService`** subscription schema
```javascript
interface SubscriptionData {
  // ... existing fields ...
  subscriptionTier: 'member' | 'captain';
  teamPermissions: {
    canCreateTeams: boolean;
    canCreatePrizeEvents: boolean;
    teamRewardsEnabled: boolean;
  };
  defaultTeam?: string; // Team ID user belongs to
}
```

### 1.2 Enhanced Subscription Modal with Tier Selection
- [ ] **Modify `SubscriptionModal.jsx`** to include tier selection
  - [ ] Add tier selection step before payment
  - [ ] Dynamic pricing based on selected tier (5k vs 10k sats)
  - [ ] Clear benefit explanation for each tier
  - [ ] Update invoice generation with correct amount

**Tier Selection UI:**
```javascript
// New step in subscription modal
<TierSelectionStep>
  <TierOption tier="member" price="5,000 sats/month">
    • Join any team
    • Daily streak rewards
    • Participate in events
  </TierOption>
  <TierOption tier="captain" price="10,000 sats/month">
    • Everything in Member +
    • Create your own team
    • Weekly team rewards
    • Create prize pool events
  </TierOption>
</TierSelectionStep>
```

### 1.3 Captain Permission System
- [ ] **Create `src/services/captainPermissionService.js`**
  - [ ] `isCaptain(userPubkey)` - Check if user has active captain subscription
  - [ ] `canCreateTeams(userPubkey)` - Team creation permission
  - [ ] `canCreatePrizeEvents(userPubkey)` - Prize event permission
  - [ ] Integration with existing access control patterns

### 1.4 Update Subscription Service for Tiers
- [ ] **Extend `MonthlySubscriptionService`**
  - [ ] Tiered invoice generation (5k vs 10k pricing)
  - [ ] Tier-specific subscription validation
  - [ ] Captain permission initialization
  - [ ] Backward compatibility with existing subscriptions

---

## Phase 2: Team Membership & Selection ⏳
**Timeline**: Week 1-2  
**Status**: 🔄 Not Started

### 2.1 Team Selection in Subscription Flow
- [ ] **Add team selection step to subscription modal**
  - [ ] Fetch available teams using existing team infrastructure
  - [ ] Team selection UI after Lightning address input
  - [ ] Captain option: "Create New Team" vs "Join Existing Team"
  - [ ] Member option: Select from existing teams only

### 2.2 Single Team Membership Enforcement
- [ ] **Create `src/services/userTeamService.js`**
  - [ ] `getUserDefaultTeam(userPubkey)` - Get user's current team from subscription
  - [ ] `setUserDefaultTeam(userPubkey, teamId)` - Update user's team
  - [ ] `enforcesSingleTeamMembership()` - Remove from old teams when joining new
  - [ ] Integration with existing team/group services

### 2.3 Team Creation for Captains
- [ ] **Enhance existing team creation flow**
  - [ ] Add captain permission check to team creation
  - [ ] Link created team to captain's subscription
  - [ ] Set captain as team owner/admin
  - [ ] Initialize team with captain as first member

### 2.4 Update Existing Team Components
- [ ] **Modify team-related components to use default team**
  - [ ] Update post publishing to use default team
  - [ ] Update team displays to show user's current team
  - [ ] Update team switching to require subscription changes
  - [ ] Maintain existing team functionality for Season Pass users

---

## Phase 3: Captain Team Rewards ⏳
**Timeline**: Week 2  
**Status**: 🔄 Not Started

### 3.1 Team Member Counting System
- [ ] **Create `src/services/teamRewardService.js`**
  - [ ] `getTeamMemberCount(teamId)` - Count active subscribers on team
  - [ ] `getCaptainTeams(captainPubkey)` - Get teams owned by captain
  - [ ] `calculateWeeklyTeamReward(teamSize)` - Reward calculation logic
  - [ ] Integration with existing team membership tracking

**Reward Calculation Logic:**
```javascript
// Base team reward structure
const calculateWeeklyTeamReward = (teamSize) => {
  const baseReward = 50; // sats per member per week
  const bonusThreshold = 10; // members
  const bonus = teamSize >= bonusThreshold ? 100 : 0; // bonus for large teams
  return (teamSize * baseReward) + bonus;
};
```

### 3.2 Weekly Team Reward Distribution
- [ ] **Extend `DailyRewardService` for weekly team rewards**
  - [ ] Weekly cron job or manual trigger for team rewards
  - [ ] Captain Lightning address validation
  - [ ] Team reward calculation and distribution
  - [ ] Transaction logging and error handling

### 3.3 Team Reward Notifications
- [ ] **Enhanced notification system for team rewards**
  - [ ] Captain notifications: "⚡ 500 sats team reward for 10 members!"
  - [ ] Team member notifications: "Your captain earned team rewards!"
  - [ ] Failed payment notifications and retry logic

---

## Phase 4: Prize Pool Events ⏳
**Timeline**: Week 3  
**Status**: 🔄 Not Started

### 4.1 Enhance Event Creation with Prize Pools
- [ ] **Modify existing event creation modal/component**
  - [ ] Add captain permission check for event creation
  - [ ] Optional prize pool input section
  - [ ] Prize pool amount validation
  - [ ] Clear terms and conditions for prize distribution

**Prize Pool UI Enhancement:**
```javascript
// Add to event creation form
<div className="prize-pool-section">
  <label>Prize Pool (optional)</label>
  <input 
    type="number" 
    placeholder="Amount in sats"
    value={prizePool}
    onChange={(e) => setPrizePool(e.target.value)}
  />
  <p className="text-sm text-gray-600">
    You'll manually distribute prizes to winners after the event
  </p>
</div>
```

### 4.2 Prize Pool Event Data Structure
- [ ] **Extend existing event data structure**
```javascript
interface PrizePoolEvent {
  // ... existing event fields ...
  prizePool: {
    totalAmount: number; // sats
    distribution: 'winner_takes_all' | 'top_3' | 'custom';
    createdBy: string; // captain pubkey
    status: 'active' | 'completed' | 'prizes_distributed';
    winners?: Array<{
      pubkey: string;
      position: number;
      prizeAmount: number;
      paid: boolean;
    }>;
  };
}
```

### 4.3 Prize Distribution Interface
- [ ] **Create captain prize distribution dashboard**
  - [ ] List completed events with prize pools
  - [ ] Winner selection/confirmation interface
  - [ ] Prize amount distribution controls
  - [ ] Batch payment processing for multiple winners

### 4.4 Prize Payment System
- [ ] **Create `src/services/prizeDistributionService.js`**
  - [ ] Winner prize calculation logic
  - [ ] Batch Lightning payments to winners
  - [ ] Payment confirmation and tracking
  - [ ] Integration with existing payment infrastructure

**Prize Distribution Flow:**
```javascript
const distributePrizes = async (eventId, winners) => {
  for (const winner of winners) {
    // Get winner's Lightning address from subscription
    const winnerSubscription = await getActiveSubscription(winner.pubkey);
    if (winnerSubscription?.lightningAddress) {
      // Send prize using existing payment infrastructure
      await sendPrize(
        winnerSubscription.lightningAddress,
        winner.prizeAmount,
        `Prize from ${eventName} - Position ${winner.position}!`
      );
    }
  }
};
```

---

## Technical Integration Points

### Leverage Existing Infrastructure

**✅ Subscription System:**
- Extend existing `MonthlySubscriptionService`
- Use existing payment and invoice generation
- Leverage existing Lightning address validation

**✅ Team/Group System:**
- Build on existing NIP-29 group infrastructure
- Use existing team creation and management
- Extend existing team membership tracking

**✅ Event System:**
- Enhance existing event creation flow
- Use existing event data structures
- Leverage existing winner determination logic

**✅ Payment Infrastructure:**
- Reuse existing NWC wallet setup
- Use existing reward distribution patterns
- Leverage existing retry and error handling

### New Components Needed

**❌ Tier Selection UI:**
- Member vs Captain selection in subscription modal
- Pricing display and benefit comparison

**❌ Team Selection UI:**
- Team selection step in subscription flow
- Create vs Join team options for captains

**❌ Prize Pool Management:**
- Prize pool input in event creation
- Prize distribution dashboard for captains

**❌ Team Reward Calculations:**
- Weekly team reward calculation service
- Team member counting and reward distribution

---

## Data Storage Strategy

### Extend Existing LocalStorage Patterns
```javascript
// Extend existing subscription data
{
  // ... existing subscription fields ...
  subscriptionTier: 'captain',
  defaultTeam: 'team-uuid-123',
  teamPermissions: {
    canCreateTeams: true,
    canCreatePrizeEvents: true,
    teamRewardsEnabled: true
  }
}

// Extend existing event data  
{
  // ... existing event fields ...
  prizePool: {
    totalAmount: 10000,
    distribution: 'top_3',
    createdBy: 'captain-pubkey',
    status: 'active'
  }
}
```

### Nostr Event Extensions
- Use existing event publishing patterns
- Extend existing team/group events
- Add prize pool metadata to event records
- Maintain backward compatibility

---

## Success Metrics & Testing

### Week 1 Success Criteria
- [ ] Tier selection working in subscription modal
- [ ] Captain subscriptions creating with correct permissions
- [ ] Team selection step integrated into subscription flow
- [ ] Single team membership enforcement working

### Week 2 Success Criteria
- [ ] Team creation restricted to captains
- [ ] Team member counting accurate
- [ ] Weekly team rewards calculating correctly
- [ ] Captain team reward distribution working

### Week 3 Success Criteria
- [ ] Prize pool events creating with correct data structure
- [ ] Prize distribution interface functional for captains
- [ ] Prize payments working with existing payment infrastructure
- [ ] End-to-end captain workflow complete

### Key Metrics
1. **Captain Conversion Rate**: % of users choosing captain tier
2. **Team Creation Rate**: Teams created per captain
3. **Team Size Distribution**: Average members per team
4. **Prize Pool Adoption**: % of events with prize pools
5. **Payment Success Rate**: Prize distribution success rate

---

## Risk Mitigation

### Low-Risk Strategy
- **Extend, Don't Replace**: Build on existing infrastructure
- **Feature Flags**: All new features can be toggled off
- **Backward Compatibility**: Existing subscriptions remain unaffected
- **Incremental Rollout**: Each phase can be deployed independently

### Rollback Plan
- Captain features can be disabled via permission service
- Prize pool events can be restricted to admins only
- Team rewards can be paused independently
- Single team membership can be relaxed if needed

### Testing Strategy
- Unit tests for all new services
- Integration tests for subscription tier flow
- End-to-end tests for captain workflows
- Payment testing with small amounts

---

## Future Enhancements (Post-Launch)

### Advanced Team Features
- Team leagues and competitions
- Team vs team events
- Team performance analytics
- Team branding and customization

### Enhanced Prize Systems
- Automatic prize distribution
- Escrow system for prize pools
- Multi-event prize tournaments
- Sponsor-funded prize pools

### Captain Tools
- Team management dashboard
- Member recruitment tools
- Team analytics and insights
- Automated team rewards optimization

---

## Implementation Priority

### Must-Have (MVP)
1. ✅ Tier selection in subscription modal
2. ✅ Team selection and single membership
3. ✅ Captain team creation permissions
4. ✅ Basic weekly team rewards

### Should-Have (V1.1)
5. ✅ Prize pool event creation
6. ✅ Manual prize distribution
7. ✅ Team reward notifications
8. ✅ Captain dashboard basics

### Nice-to-Have (V1.2)
9. Team performance analytics
10. Automated prize distribution
11. Advanced team management tools
12. Enhanced notification system

---

## Progress Tracking

**Last Updated**: 2025-01-31  
**Current Phase**: Planning Complete ✅  
**Next Milestone**: Begin Phase 1 Development  

### Completion Status
- [ ] Phase 1: Subscription Tier System (0/4 tasks)
- [ ] Phase 2: Team Membership & Selection (0/4 tasks)
- [ ] Phase 3: Captain Team Rewards (0/3 tasks)
- [ ] Phase 4: Prize Pool Events (0/4 tasks)

**Overall Progress**: 0% Complete

**Dependencies**: 
- Requires completion of basic subscription system from `SUBSCRIPTION_IMPLEMENTATION_PLAN.md`
- Can begin Phase 1 after basic subscription modal is functional