# Subscription Implementation Plan

**Target**: Two-tier subscription system (Member 5k/Captain 10k sats) following Season Pass patterns  
**Approach**: Nostr-native with Kind 33407 subscription receipts + NIP-51 lists  
**Timeline**: 2 weeks for core subscription flow  
**Status**: 🚀 Ready for Implementation  

## System Overview

### Subscription Architecture (Identical to Season Pass)
1. User pays subscription (5k Member / 10k Captain)
2. App publishes **Kind 33407** subscription receipt event
3. Admin runs script to verify payments and update NIP-51 lists
4. App checks subscription status from NIP-51 lists

### Nostr Event Structure

**Subscription Receipt Event (Kind 33407):**
```javascript
{
  kind: 33407,
  tags: [
    ["d", "runstr-subscription-02-2025"], // Format: runstr-subscription-{MM}-{YYYY}
    ["tier", "member"], // or "captain"
    ["amount", "5000"], // or "10000" for captain
    ["purchase_date", "1738339200"], // Unix timestamp
    ["expires", "1740931200"], // Unix timestamp (30 days later)
    ["payment_hash", "..."], // For verification
  ],
  content: "", // Can be encrypted payment details
  created_at: 1738339200,
  pubkey: "user-pubkey"
}
```

**NIP-51 Subscription Lists (Kind 30000):**
- `runstr-members-02-2025` - All active member subscribers for February 2025
- `runstr-captains-02-2025` - All active captain subscribers for February 2025

---

## Phase 1: Core Subscription Service ⏳
**Timeline**: Week 1  
**Status**: 🔄 In Progress

### 1.1 Create Monthly Subscription Service
- [ ] **Create `src/services/monthlySubscriptionService.js`**
  - [ ] Based on existing `seasonPassPaymentService.ts` patterns
  - [ ] Two-tier pricing: Member (5k) / Captain (10k)
  - [ ] Generate monthly subscription invoices
  - [ ] Publish Kind 33407 events after payment
  - [ ] Check subscription status from NIP-51 lists

**Key Functions:**
```javascript
class MonthlySubscriptionService {
  // Generate subscription invoice
  async generateSubscriptionInvoice(userPubkey, tier) // tier: 'member' | 'captain'
  
  // Verify payment and publish receipt
  async confirmSubscriptionPayment(userPubkey, tier, paymentHash)
  
  // Check if user has active subscription
  async isSubscriptionActive(userPubkey)
  
  // Get user's subscription tier
  async getSubscriptionTier(userPubkey) // returns 'member' | 'captain' | null
  
  // Publish Kind 33407 subscription receipt
  async publishSubscriptionReceipt(subscriptionData)
}
```

### 1.2 Create Subscription Modal
- [ ] **Create `src/components/modals/SubscriptionModal.jsx`**
  - [ ] Based on `SeasonPassPaymentModal.tsx` patterns
  - [ ] Tier selection step (Member vs Captain)
  - [ ] Payment QR code generation
  - [ ] Payment confirmation flow
  - [ ] Success state with subscription details

**Modal Flow:**
1. **Tier Selection**: Choose between Member (5k) and Captain (10k)
2. **Payment**: Generate invoice, show QR code, verify payment
3. **Success**: Publish receipt event, show confirmation

### 1.3 Enhanced Subscription List Service
- [ ] **Create `src/services/enhancedSubscriptionService.ts`**
  - [ ] Based on `enhancedSeasonPassService.ts` patterns
  - [ ] Fetch NIP-51 subscription lists from relays
  - [ ] Cache subscription data locally
  - [ ] Handle both member and captain tiers
  - [ ] Merge local and Nostr data sources

### 1.4 Add Subscribe Button to Profile
- [ ] **Modify `src/pages/Profile.jsx`**
  - [ ] Add subscription section after fitness data
  - [ ] Show current subscription status
  - [ ] Subscribe/Upgrade buttons based on current tier
  - [ ] Display expiry date for active subscriptions

---

## Phase 2: Admin Management Tools ⏳
**Timeline**: Week 1-2  
**Status**: 🔄 Not Started

### 2.1 Admin Subscription Script
- [ ] **Create `scripts/manage-subscriptions.js`**
  - [ ] Query all Kind 33407 events for current month
  - [ ] Verify payment hashes if possible
  - [ ] Generate member and captain lists
  - [ ] Update NIP-51 lists on relays
  - [ ] Handle subscription expirations

**Script Functions:**
```javascript
// Find all subscription receipts for current month
async function fetchSubscriptionReceipts(month, year)

// Verify subscriptions and categorize by tier
async function categorizeSubscriptions(receipts)

// Update NIP-51 lists for members and captains
async function updateSubscriptionLists(members, captains, month, year)

// Main function to run monthly
async function updateMonthlySubscriptions()
```

### 2.2 Subscription Monitoring Dashboard
- [ ] **Create simple monitoring interface**
  - [ ] Total active subscriptions by tier
  - [ ] Recent subscription events
  - [ ] Expiring subscriptions list
  - [ ] Manual list management interface

---

## Phase 3: Captain Features & Team Integration ⏳
**Timeline**: Week 2  
**Status**: 🔄 Not Started

### 3.1 Captain Permissions
- [ ] **Update team creation to require Captain subscription**
  - [ ] Check captain tier in team creation flow
  - [ ] Show upgrade prompt for members trying to create teams
  - [ ] Restrict team management to captains

### 3.2 Team Selection for Members
- [ ] **Add team selection to subscription flow**
  - [ ] After payment, show available teams
  - [ ] Allow members to join one team
  - [ ] Store team selection with subscription data
  - [ ] Update team membership on subscription

### 3.3 Prize Pool Events (Captain Only)
- [ ] **Enhance event creation for captains**
  - [ ] Check captain subscription before allowing prize events
  - [ ] Add prize pool amount to event creation
  - [ ] Basic prize distribution interface

---

## Phase 4: Future Enhancements (Post-Launch) ⏳
**Timeline**: After core implementation  
**Status**: 📋 Planned

### 4.1 Lightning Address Integration
- [ ] **Add Lightning address collection**
  - [ ] Optional field in subscription flow
  - [ ] Validation with 1-sat test payment
  - [ ] Store in subscription receipt event
  - [ ] Enable automatic rewards

### 4.2 Automatic Reward System
- [ ] **Subscription-gated daily rewards**
  - [ ] Only subscribers receive rewards
  - [ ] Use subscription Lightning addresses
  - [ ] Captain bonus rewards
  - [ ] Team-based reward multipliers

### 4.3 Advanced Features
- [ ] **Auto-renewal system**
- [ ] **Subscription analytics**
- [ ] **Referral rewards**
- [ ] **Bulk team subscriptions**

---

## Technical Implementation Details

### Storage Strategy
```javascript
// LocalStorage (for offline support)
'monthlySubscriptions' - Current user's subscription data
'subscriptionCache' - Cached NIP-51 lists

// Nostr Events
Kind 33407 - Subscription receipts (published by users)
Kind 30000 - NIP-51 subscription lists (published by admin)
```

### Subscription Status Checking
```javascript
// Check subscription status (similar to Season Pass)
async function isUserSubscribed(userPubkey) {
  // 1. Check cached NIP-51 lists
  const cachedStatus = checkCachedSubscriptionLists(userPubkey);
  if (cachedStatus) return cachedStatus;
  
  // 2. Fetch latest NIP-51 lists from relays
  const lists = await fetchSubscriptionLists();
  
  // 3. Check if user is in member or captain list
  return checkUserInLists(userPubkey, lists);
}
```

### Integration with Existing Systems
- **Payment**: Uses existing NWC wallet infrastructure
- **Events**: Follows existing Nostr event patterns
- **UI**: Extends existing modal and profile patterns
- **Access Control**: Integrates with existing participant checking

---

## Implementation Checklist

### Immediate Actions (Day 1)
- [ ] Create monthlySubscriptionService.js
- [ ] Set up Kind 33407 event structure
- [ ] Create basic subscription modal
- [ ] Add subscribe button to profile

### Week 1 Goals
- [ ] Complete subscription payment flow
- [ ] Subscription receipt event publishing working
- [ ] Basic tier selection (Member/Captain)
- [ ] Manual admin script for list management

### Week 2 Goals
- [ ] Enhanced subscription service with NIP-51
- [ ] Captain features (team creation)
- [ ] Subscription status display in UI
- [ ] Testing and polish

---

## Success Metrics

### Technical Success
- [ ] Subscription payment flow works end-to-end
- [ ] Kind 33407 events publishing correctly
- [ ] NIP-51 lists updating properly
- [ ] Subscription status checking accurate

### User Experience Success
- [ ] Clear tier selection and benefits
- [ ] Smooth payment experience
- [ ] Immediate subscription confirmation
- [ ] Visible subscription status in app

### Business Success
- [ ] Conversion rate tracking
- [ ] Tier distribution (Member vs Captain)
- [ ] Subscription retention metrics
- [ ] Revenue tracking

---

## Risk Mitigation

### Low-Risk Implementation
- **Follows Existing Patterns**: Based on proven Season Pass code
- **Manual Admin Control**: Admin manages lists initially
- **Gradual Rollout**: Can test with small group first
- **Reversible**: Can disable subscriptions without affecting Season Pass

### Backup Plans
- **Payment Issues**: Fall back to manual subscription management
- **Event Publishing Fails**: Store locally and retry
- **List Updates Fail**: Use cached data with manual updates
- **Captain Features**: Can be restricted if issues arise

---

## Current Status & Next Steps

**Current Status**: Ready to begin implementation  
**Next Step**: Create monthlySubscriptionService.js based on seasonPassPaymentService.ts  
**Priority**: Core subscription flow (Phase 1) first, enhancements later  

**Key Principle**: Keep it simple, follow existing patterns, iterate based on user feedback

---

## Progress Tracking

**Last Updated**: 2025-01-31  
**Current Phase**: Phase 1 - Core Subscription Service  
**Implementation Status**: Starting Development

### Phase Completion
- [ ] Phase 1: Core Subscription Service (0/4 tasks)
- [ ] Phase 2: Admin Management Tools (0/2 tasks)
- [ ] Phase 3: Captain Features & Team Integration (0/3 tasks)
- [ ] Phase 4: Future Enhancements (Lightning addresses, auto-rewards)

**Overall Progress**: 0% Complete