# Subscription + Daily Auto Rewards Implementation Plan

**Target**: Simple 5k sats/month subscription with automatic daily rewards for streak completion  
**Approach**: Leverage existing Season Pass architecture (Approach 1)  
**Timeline**: 4 weeks phased implementation  

## User Flow Overview
1. User goes to Profile page and sees Subscribe button
2. Modal pops up with subscription info and generates 5k sats invoice
3. After payment, user inputs Lightning address for auto payouts
4. Lightning address is validated with 1-sat test payment  
5. User receives daily rewards automatically when completing streaks

---

## Phase 1: Core Subscription Infrastructure ⏳
**Timeline**: Week 1  
**Status**: 🔄 Not Started

### 1.1 Extend Season Pass Architecture
- [ ] **Create `src/services/monthlySubscriptionService.js`**
  - [ ] Core subscription CRUD operations
  - [ ] Invoice generation using existing NWC wallet
  - [ ] Payment confirmation and status management
  - [ ] Integration with existing localStorage patterns
  - [ ] Nostr event publishing for subscription receipts

**Data Structure:**
```javascript
interface SubscriptionData {
  id: string;
  pubkey: string;
  type: 'premium';
  purchaseDate: string;
  expiryDate: string;
  status: 'pending_payment' | 'active' | 'expired' | 'cancelled';
  amount: 5000;
  paymentHash?: string;
  lightningAddress?: string;
  autoRewards: boolean;
  addressVerified: boolean;
}
```

### 1.2 Add Subscribe Button to Profile
- [ ] **Modify `src/pages/Profile.jsx`** (around line 220)
  - [ ] Add subscription status section with premium branding
  - [ ] Subscribe button with conditional text (Subscribe/Subscribed)
  - [ ] Subscription expiry and Lightning address display
  - [ ] State management for subscription modal

### 1.3 Create Subscription Modal
- [ ] **Create `src/components/modals/SubscriptionModal.jsx`**
  - [ ] Multi-step modal: Info → Payment → Address → Success
  - [ ] QR code display for Lightning invoice
  - [ ] Payment confirmation handling
  - [ ] Lightning address input with validation
  - [ ] Follow existing modal patterns from `SeasonPassPaymentModal.tsx`

**Modal Steps:**
1. **Info Step**: Subscription benefits and pricing
2. **Payment Step**: QR code and payment confirmation  
3. **Address Step**: Lightning address input and validation
4. **Success Step**: Confirmation and next steps

---

## Phase 2: Lightning Address Validation & Storage ⏳
**Timeline**: Week 2  
**Status**: 🔄 Not Started

### 2.1 Reliable Lightning Address Testing
- [ ] **Create `src/services/lightningAddressValidator.js`**
  - [ ] Format validation (user@domain.com pattern)
  - [ ] LNURL endpoint connectivity test
  - [ ] 1-sat test payment to verify address works
  - [ ] Comprehensive error handling and user feedback
  - [ ] Integration with existing NWC wallet

**Validation Flow:**
```javascript
validateAndTest(lightningAddress) → {
  1. Format validation
  2. LNURL endpoint test  
  3. 1-sat test payment
  4. Return success/error with specific messages
}
```

### 2.2 Update Subscription Service with Address Management
- [ ] **Extend `MonthlySubscriptionService`**
  - [ ] `updateLightningAddress()` method with validation
  - [ ] Address verification status tracking
  - [ ] Auto-rewards enablement after successful validation
  - [ ] Error handling for invalid addresses

### 2.3 Address Input UI Enhancement
- [ ] **Enhance subscription modal address step**
  - [ ] Real-time format validation
  - [ ] Loading states during validation
  - [ ] Clear error messages for validation failures
  - [ ] Success confirmation with test payment notification

---

## Phase 3: Daily Reward Automation ⏳
**Timeline**: Week 3  
**Status**: 🔄 Not Started

### 3.1 Hook into Existing Streak System
- [ ] **Modify `src/utils/streakUtils.ts`** (around line 89)
  - [ ] Add subscription check to `updateUserStreak()`
  - [ ] Trigger daily rewards after streak completion
  - [ ] Update `lastRewardedDay` tracking
  - [ ] Maintain existing streak logic integrity

### 3.2 Create Daily Reward Service
- [ ] **Create `src/services/dailyRewardService.js`**
  - [ ] Core reward triggering logic
  - [ ] Retry mechanism for failed payments (3 attempts)
  - [ ] Exponential backoff between retries
  - [ ] Reward calculation with streak bonuses
  - [ ] Transaction logging and user notifications

**Reward Logic:**
- Base reward: 100 sats per day
- Streak bonus: +10 sats per week completed
- Maximum reward: 300 sats (capped)
- Retry attempts: 3 with exponential backoff

### 3.3 Payment Retry System
- [ ] **Implement robust retry logic**
  - [ ] Failed payment queue in localStorage
  - [ ] Automatic retry with exponential backoff
  - [ ] Maximum retry attempts (5 total)
  - [ ] User notifications for persistent failures
  - [ ] Manual retry triggers for admins

### 3.4 User Notifications
- [ ] **Enhance notification system**
  - [ ] Success: "⚡ 100 sats reward sent for day X streak!"
  - [ ] Failure: "❌ Failed to send reward. Will retry later."
  - [ ] Android toast notifications
  - [ ] Browser notification fallback
  - [ ] In-app notification history

---

## Phase 4: Integration & Polish ⏳
**Timeline**: Week 4  
**Status**: 🔄 Not Started

### 4.1 Extend Existing Access Control
- [ ] **Update `src/services/enhancedSeasonPassService.ts`**
  - [ ] Create `isParticipantOrSubscriber()` function
  - [ ] Update all existing participant checks
  - [ ] Maintain backward compatibility with Season Pass
  - [ ] Add subscription status to feed filtering

### 4.2 Add Subscription Management to Profile
- [ ] **Enhance Profile page subscription section**
  - [ ] Active subscription status display
  - [ ] Expiry date and renewal reminders
  - [ ] Lightning address management
  - [ ] Auto-rewards status toggle
  - [ ] Historical reward summary

### 4.3 Error Recovery & Monitoring
- [ ] **Create comprehensive error handling**
  - [ ] Failed reward queue management
  - [ ] Retry mechanism for failed payments
  - [ ] User-friendly error messages
  - [ ] Admin monitoring dashboard (future)
  - [ ] Transaction history logging

### 4.4 Testing & Quality Assurance
- [ ] **Comprehensive testing suite**
  - [ ] Subscription flow end-to-end testing
  - [ ] Lightning address validation edge cases
  - [ ] Payment retry mechanism testing
  - [ ] Error handling validation
  - [ ] Performance testing with multiple subscribers

---

## Technical Architecture

### Storage Strategy
- **Primary**: localStorage (offline support, instant access)
- **Backup**: Nostr events (decentralized, cross-client compatibility)
- **Key**: `monthlySubscriptions` (similar to `seasonPassParticipants`)

### Payment Infrastructure
- **Wallet**: Existing NWC wallet with RUNSTR_REWARD_NWC_URI
- **Invoice Generation**: Reuse existing `makeInvoice()` patterns
- **Payment Verification**: Extend existing payment confirmation logic
- **Retry Logic**: New exponential backoff system

### Integration Points
- **Streak System**: Hook into `updateUserStreak()` in streakUtils.ts
- **Access Control**: Extend existing participant filtering
- **UI Components**: Follow SeasonPassPaymentModal patterns
- **Notifications**: Use existing Android toast + browser notifications

---

## Success Metrics & KPIs

### Week 1 Success Criteria
- [ ] Subscription service operational with payment flow
- [ ] Subscribe button visible and functional on Profile page
- [ ] Basic subscription modal working with invoice generation
- [ ] LocalStorage subscription data properly structured

### Week 2 Success Criteria  
- [ ] Lightning address validation working with 1-sat tests
- [ ] Address input step integrated into subscription flow
- [ ] >90% address validation success rate in testing
- [ ] Clear error messaging for invalid addresses

### Week 3 Success Criteria
- [ ] Daily rewards automatically triggered after streak completion
- [ ] >95% reward delivery success rate
- [ ] Retry mechanism handling failed payments appropriately
- [ ] User notifications working for both success and failure cases

### Week 4 Success Criteria
- [ ] Complete subscription management in Profile page
- [ ] Integration with existing access control systems
- [ ] Error recovery system operational
- [ ] End-to-end testing completed successfully

### Overall Success Metrics
1. **Payment Success Rate**: >95% subscription payments processed
2. **Address Validation Rate**: >90% Lightning addresses validated successfully  
3. **Daily Reward Delivery**: >90% rewards delivered within 5 minutes
4. **User Experience**: Seamless flow from subscription to reward receipt
5. **System Reliability**: <1% error rate in reward distribution

---

## Risk Mitigation

### Identified Risks
1. **Lightning Address Failures**: Mitigated by 1-sat testing + retry logic
2. **Payment Processing Issues**: Mitigated by existing proven NWC infrastructure
3. **Streak Integration Bugs**: Mitigated by careful integration with existing logic
4. **User Experience Friction**: Mitigated by following existing modal patterns

### Rollback Plan
- Subscription service can be disabled via feature flag
- Existing Season Pass functionality remains unaffected
- Daily rewards can be paused independently of subscriptions
- LocalStorage data can be migrated or reset if needed

---

## Future Enhancements (Post-Launch)

### Tier System
- Regular Member: 5,000 sats/month
- Captain: 10,000 sats/month  
- Premium features per tier

### Advanced Features
- Team subscriptions with bulk discounts
- Automatic renewal with saved payment methods
- Reward customization and preferences
- Analytics and reward history dashboard
- Integration with Nostr profile Lightning addresses

### Scaling Considerations
- Batch reward processing for multiple subscribers
- Database migration from localStorage
- Advanced payment routing and optimization
- Enhanced monitoring and alerting systems

---

## Progress Tracking

**Last Updated**: 2025-01-31  
**Current Phase**: Planning Complete ✅  
**Next Milestone**: Begin Phase 1 Development  

### Completion Status
- [ ] Phase 1: Core Subscription Infrastructure (0/3 tasks)
- [ ] Phase 2: Lightning Address Validation & Storage (0/3 tasks)  
- [ ] Phase 3: Daily Reward Automation (0/4 tasks)
- [ ] Phase 4: Integration & Polish (0/4 tasks)

**Overall Progress**: 0% Complete