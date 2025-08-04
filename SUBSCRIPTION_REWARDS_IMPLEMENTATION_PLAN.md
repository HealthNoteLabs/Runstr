# Subscription-Gated Automatic Rewards Implementation Plan

**Target**: Two-tier subscription system (Member 5k/Captain 10k sats) with automatic daily rewards for subscribers only  
**Key Change**: Only subscribers receive automatic rewards, Lightning addresses collected during subscription  
**Timeline**: 4 weeks phased implementation  
**Risk Level**: LOW - Extends existing infrastructure safely  

## System Overview

### Subscription-Gated Rewards
- **No Subscription = No Rewards**: Only active subscribers receive automatic daily rewards
- **Member Tier**: 5k sats/month → Daily streak rewards + team participation
- **Captain Tier**: 10k sats/month → All member benefits + team creation + team rewards + prize events

### Lightning Address Strategy
- **Collection Point**: Lightning addresses collected during subscription flow (not from profiles)
- **Validation**: 1-sat test payment to verify address works before enabling rewards
- **Reliability**: Solves Primal and other profile-based Lightning address issues

### User Flow
1. User subscribes (Member/Captain tier)
2. Pays subscription invoice
3. Inputs Lightning address for rewards
4. Address validated with test payment
5. Daily rewards automatically sent on streak completion

---

## Phase 1: Core Subscription Infrastructure ⏳
**Timeline**: Week 1  
**Status**: 🔄 Not Started

### 1.1 Create Subscription Service
- [ ] **Create `src/services/subscriptionService.js`**
  - [ ] Two-tier subscription management (Member 5k/Captain 10k)
  - [ ] Lightning address storage and validation
  - [ ] Subscription status checking
  - [ ] Integration with existing NWC payment infrastructure

**Subscription Data Structure:**
```javascript
interface SubscriptionData {
  id: string;
  pubkey: string;
  tier: 'member' | 'captain';
  purchaseDate: string;
  expiryDate: string;
  status: 'pending_payment' | 'active' | 'expired';
  amount: 5000 | 10000;
  paymentHash?: string;
  lightningAddress?: string;
  addressVerified: boolean;
  autoRewardsEnabled: boolean;
  defaultTeam?: string; // For future team integration
}
```

### 1.2 Enhanced Subscription Modal
- [ ] **Create `src/components/modals/SubscriptionModal.jsx`**
  - [ ] Tier selection step (Member vs Captain with benefits)
  - [ ] Payment step with QR code (reuse existing patterns)
  - [ ] Lightning address input step with validation
  - [ ] Success confirmation step

**Modal Flow:**
1. **Tier Selection**: Choose Member (5k) or Captain (10k) with clear benefits
2. **Payment**: Generate invoice, show QR code, wait for confirmation
3. **Lightning Address**: Input and validate address with 1-sat test
4. **Success**: Confirm subscription and reward setup

### 1.3 Add Subscription Access to Profile
- [ ] **Modify `src/pages/Profile.jsx`**
  - [ ] Add subscription section with subscribe button
  - [ ] Show subscription status (tier, expiry, Lightning address)
  - [ ] Subscription management (view details, update address)

### 1.4 Lightning Address Validator
- [ ] **Create `src/services/lightningAddressValidator.js`**
  - [ ] Format validation (user@domain.com)
  - [ ] LNURL endpoint connectivity test
  - [ ] 1-sat test payment to verify functionality
  - [ ] Clear error messaging for validation failures

---

## Phase 2: Subscription-Gated Reward System ⏳
**Timeline**: Week 2  
**Status**: 🔄 Not Started

### 2.1 Update Streak System for Subscription Requirements
- [ ] **Modify `src/utils/streakUtils.ts`**
  - [ ] Add subscription check before reward calculation
  - [ ] Use subscription Lightning address for rewards
  - [ ] Show subscription prompts for non-subscribers

**Key Changes:**
```javascript
// In updateUserStreak function
const subscription = await subscriptionService.getActiveSubscription(userPubkey);
if (!subscription || !subscription.autoRewardsEnabled) {
  // Show subscription prompt instead of rewards
  return streakData; // No rewards for non-subscribers
}

// Use subscription Lightning address for rewards
const lightningAddress = subscription.lightningAddress;
await sendRewardToSubscriber(userPubkey, lightningAddress, rewardAmount);
```

### 2.2 Create Subscription Reward Service
- [ ] **Create `src/services/subscriptionRewardService.js`**
  - [ ] Daily reward calculation with subscription validation
  - [ ] Reliable payment processing with retry logic
  - [ ] Transaction logging and error handling
  - [ ] User notifications for reward status

**Reward Logic:**
- Base reward: 100 sats per streak day
- Streak bonus: +10 sats per week completed (max 300 sats)
- Captain bonus: +50 sats for team rewards
- Retry failed payments up to 3 times with exponential backoff

### 2.3 Update Existing Reward Infrastructure
- [ ] **Modify `src/services/rewardService.js`**
  - [ ] Add subscription validation to `sendRewardZap()`
  - [ ] Prioritize subscription Lightning address over profile
  - [ ] Update fallback chain for non-subscribers

### 2.4 Enhanced Reward UI for Non-Subscribers
- [ ] **Modify `src/hooks/useStreakRewards.ts`**
  - [ ] Show subscription upsell for non-subscribers
  - [ ] Clear messaging about subscription benefits
  - [ ] Direct link to subscription modal

---

## Phase 3: Captain Features & Team Rewards ⏳
**Timeline**: Week 3  
**Status**: 🔄 Not Started

### 3.1 Captain Permission System
- [ ] **Create `src/services/captainPermissionService.js`**
  - [ ] Captain subscription validation
  - [ ] Team creation permissions
  - [ ] Prize event permissions
  - [ ] Integration with existing access controls

### 3.2 Team Selection in Subscription Flow
- [ ] **Enhance subscription modal with team selection**
  - [ ] Show available teams for Members
  - [ ] Option to create new team for Captains
  - [ ] Single team membership enforcement
  - [ ] Team switching requires subscription changes

### 3.3 Captain Team Rewards
- [ ] **Create `src/services/teamRewardService.js`**
  - [ ] Weekly team reward calculation (50 sats per member)
  - [ ] Team member counting for active subscribers
  - [ ] Automatic distribution to Captain's Lightning address
  - [ ] Team reward notifications

### 3.4 Prize Pool Events (Basic Implementation)
- [ ] **Enhance existing event creation for Captains**
  - [ ] Add optional prize pool input to event creation
  - [ ] Captain-only prize event creation
  - [ ] Basic prize distribution interface
  - [ ] Manual prize payment to winners

---

## Phase 4: Integration & Polish ⏳
**Timeline**: Week 4  
**Status**: 🔄 Not Started

### 4.1 Update Access Control Systems
- [ ] **Extend existing participant checking**
  - [ ] Update `enhancedSeasonPassService.ts` for subscription integration
  - [ ] Create unified access control that checks both Season Pass and subscriptions
  - [ ] Maintain backward compatibility

### 4.2 Comprehensive Error Handling
- [ ] **Create robust error recovery system**
  - [ ] Failed reward queue with persistent retry
  - [ ] Lightning address validation error recovery
  - [ ] User-friendly error notifications
  - [ ] Admin monitoring dashboard preparation

### 4.3 Subscription Management Dashboard
- [ ] **Enhance Profile page with full subscription management**
  - [ ] Subscription history and renewal dates
  - [ ] Lightning address management and testing
  - [ ] Reward history and statistics
  - [ ] Team management for Captains

### 4.4 Testing & Quality Assurance
- [ ] **Comprehensive testing suite**
  - [ ] Subscription flow end-to-end testing
  - [ ] Reward gating validation
  - [ ] Lightning address validation edge cases
  - [ ] Captain feature testing
  - [ ] Migration testing for existing users

---

## Technical Implementation Details

### Storage Strategy
```javascript
// LocalStorage keys
'userSubscriptions' // Array of subscription data
'subscriptionLightningAddresses' // Map of pubkey -> lightning address
'failedRewards' // Queue for retry processing

// Nostr Events
Kind 33408: Subscription receipts
Kind 33409: Team membership events
Kind 33410: Prize pool events
```

### Payment Infrastructure Integration
- **Extend Existing NWC Wallet**: Use existing `RUNSTR_REWARD_NWC_URI`
- **Reuse Payment Patterns**: Follow `seasonPassPaymentService.ts` patterns
- **Lightning Address Testing**: 1-sat validation payments
- **Retry Logic**: Exponential backoff for failed payments

### Access Control Integration
```javascript
// Unified access checking
const hasAccess = async (userPubkey) => {
  // Check Season Pass (legacy)
  const isSeasonPassParticipant = await enhancedSeasonPassService.isParticipant(userPubkey);
  
  // Check Subscription (new)
  const hasActiveSubscription = await subscriptionService.isSubscriptionActive(userPubkey);
  
  return isSeasonPassParticipant || hasActiveSubscription;
};
```

---

## Migration Strategy for Existing Users

### Season Pass Participants
- [ ] **Grandfather existing Season Pass users**
  - [ ] Maintain existing rewards for Season Pass participants
  - [ ] Offer migration path to subscription system
  - [ ] Collect Lightning addresses from existing participants

### Reward System Transition
- [ ] **Gradual migration approach**
  - [ ] Phase 1: Both systems work (Season Pass + Subscriptions)
  - [ ] Phase 2: Encourage subscription upgrades
  - [ ] Phase 3: Full transition to subscription-only rewards

---

## Success Metrics & KPIs

### Week 1 Success Criteria
- [ ] Subscription service operational with tier selection
- [ ] Lightning address collection and validation working
- [ ] Subscribe button functional on Profile page
- [ ] Payment flow generating correct invoices for tiers

### Week 2 Success Criteria
- [ ] Rewards properly gated behind subscriptions
- [ ] Non-subscribers see subscription prompts instead of rewards
- [ ] Subscription Lightning addresses used for reward delivery
- [ ] >95% reward delivery success rate for subscribers

### Week 3 Success Criteria
- [ ] Captain features functional (team creation, team rewards)
- [ ] Team selection integrated into subscription flow
- [ ] Basic prize pool events working
- [ ] Weekly team rewards distributing correctly

### Week 4 Success Criteria
- [ ] Complete subscription management in Profile
- [ ] Error handling and retry systems operational
- [ ] Season Pass integration maintained
- [ ] End-to-end subscription and reward flow tested

### Key Performance Indicators
1. **Subscription Conversion Rate**: % of users who subscribe
2. **Reward Delivery Success**: >95% rewards delivered successfully
3. **Lightning Address Validation**: >90% addresses validate successfully
4. **Captain Adoption**: % of subscriptions choosing Captain tier
5. **User Retention**: Subscription renewal rates

---

## Risk Mitigation

### Low-Risk Implementation Strategy
- **Extend, Don't Replace**: Build on existing Season Pass infrastructure
- **Feature Flags**: All new features can be toggled off
- **Backward Compatibility**: Season Pass users maintain access
- **Incremental Rollout**: Each phase can be deployed independently

### Rollback Plans
- **Subscription System**: Can be disabled, falling back to Season Pass only
- **Reward Gating**: Can be relaxed to include non-subscribers temporarily
- **Lightning Address**: Can fallback to profile-based addresses if needed
- **Captain Features**: Can be restricted to admins only

### Testing Strategy
- **Unit Tests**: All new services and validation logic
- **Integration Tests**: Subscription flow and reward distribution
- **Lightning Tests**: Small-amount testing with real Lightning addresses
- **User Acceptance Testing**: Complete subscription and reward workflows

---

## Future Enhancements (Post-Launch)

### Advanced Subscription Features
- **Auto-Renewal**: Automatic subscription renewals with saved payment methods
- **Family Plans**: Multiple users under one subscription
- **Corporate Subscriptions**: Team-based billing and management
- **Subscription Analytics**: Detailed usage and reward analytics

### Enhanced Team Economy
- **Team Competitions**: Structured leagues and tournaments
- **Advanced Prize Systems**: Escrow, automatic distribution, sponsor funding
- **Team Analytics**: Performance tracking and insights
- **Team Branding**: Custom team themes and badges

### Monetization Optimizations
- **Dynamic Pricing**: Market-based subscription pricing
- **Reward Optimization**: AI-driven reward amounts and triggers
- **Retention Programs**: Loyalty bonuses and long-term subscriber benefits
- **Partnership Integration**: Sponsor rewards and branded challenges

---

## Implementation Dependencies

### Prerequisites
- [ ] Existing NWC wallet infrastructure operational
- [ ] Season Pass system functional (for backward compatibility)
- [ ] Basic team/group infrastructure available
- [ ] Event creation system working

### External Dependencies
- **Lightning Network**: Reliable Lightning address resolution
- **Nostr Network**: Event publishing and subscription receipt storage
- **Mobile Platform**: Android payment handling and notifications

---

## Progress Tracking

**Last Updated**: 2025-01-31  
**Current Phase**: Planning Complete ✅  
**Next Milestone**: Begin Phase 1 Development  

### Completion Status
- [ ] Phase 1: Core Subscription Infrastructure (0/4 tasks)
- [ ] Phase 2: Subscription-Gated Reward System (0/4 tasks)
- [ ] Phase 3: Captain Features & Team Rewards (0/4 tasks)
- [ ] Phase 4: Integration & Polish (0/4 tasks)

**Overall Progress**: 0% Complete

**Critical Success Factors:**
1. ✅ Lightning address reliability through subscription collection
2. ✅ Clear subscription value proposition with immediate rewards
3. ✅ Seamless migration for existing Season Pass users
4. ✅ Robust error handling and retry mechanisms
5. ✅ Captain features creating strong incentives for higher tier

This plan creates a sustainable subscription-based economy where rewards are exclusive to subscribers, solving Lightning address reliability issues while providing clear value at both Member and Captain tiers.