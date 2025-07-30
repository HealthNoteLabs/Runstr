# RUNSTR Subscription & Rewards System Roadmap

## Overview
Transform RUNSTR into a subscription-based platform with automatic rewards, NIP-60 e-cash wallets, and enhanced team participation incentives.

## Subscription Tiers
- **Regular Member**: 5,000 sats/month
- **Captain**: 10,000 sats/month
- **Team Switching**: 1,000 sats (one-time fee)

## Core Features
- Monthly subscription system
- NIP-60 e-cash wallets for subscribers
- Automatic daily activity rewards (streak-based)
- Captain daily payouts based on team size
- Team participation restrictions for non-subscribers

---

## Phase 1: Foundation & Subscription System
**Duration**: 2-3 weeks

### 1.1 Subscription Infrastructure
- [ ] Create subscription database schema (user_subscriptions table)
- [ ] Build subscription management service
- [ ] Implement monthly subscription payment flow
- [ ] Add NWC integration for receiving subscription payments
- [ ] Create subscription status checking utilities

### 1.2 Access Control System
- [ ] Implement subscription middleware/guards
- [ ] Update team join/leave logic to check subscription status
- [ ] Restrict league participation to subscribers only
- [ ] Add subscription status to user context/state

### 1.3 UI/UX for Subscriptions
- [ ] Design subscription selection/upgrade modals
- [ ] Create subscription status indicators in UI
- [ ] Build team switching payment flow
- [ ] Add "Subscribe to join teams" messaging for non-subscribers

### 1.4 Grandfathering System
- [ ] Identify existing captains in database
- [ ] Grant "lifetime captain" status to existing captains
- [ ] Create migration script for existing team members
- [ ] Add membership expiration warnings for existing members

---

## Phase 2: NIP-60 E-cash Wallet Integration
**Duration**: 2-3 weeks

### 2.1 Wallet Infrastructure
- [ ] Audit existing NIP-60 implementation in codebase
- [ ] Create wallet generation service for new subscribers
- [ ] Build wallet management interface
- [ ] Implement wallet balance checking

### 2.2 Wallet UI Components
- [ ] Design wallet interface for subscribers
- [ ] Create wallet balance display
- [ ] Build transaction history view
- [ ] Add wallet settings/management page

### 2.3 Wallet Integration Points
- [ ] Trigger wallet creation on subscription activation
- [ ] Connect wallet to reward distribution system
- [ ] Implement wallet backup/recovery features
- [ ] Add wallet status to user profile

---

## Phase 3: Automatic Rewards System
**Duration**: 2-3 weeks

### 3.1 Daily Activity Rewards
- [ ] Create streak tracking system (minimum 0.25 miles)
- [ ] Implement progressive reward calculation:
  - Day 1: 50 sats
  - Day 2: 100 sats
  - Day 3: 150 sats
  - Day 4: 200 sats
  - Day 5: 250 sats
  - Day 6: 300 sats
  - Day 7: 350 sats
  - **Monthly cap**: 3,000 sats maximum
- [ ] Build reward distribution service with NWC integration
- [ ] Create reward notification system

### 3.2 Captain Payout System
- [ ] Calculate daily captain rewards based on team member count
- [ ] Implement automatic captain payout distribution
- [ ] Create captain earnings dashboard
- [ ] Add captain payout history tracking

### 3.3 Reward Processing
- [ ] Build automated reward processing job/scheduler
- [ ] Implement reward validation and fraud prevention
- [ ] Create reward transaction logging
- [ ] Add retry mechanisms for failed payments

---

## Phase 4: Enhanced Team Rewards & Incentives
**Duration**: 2-3 weeks

### 4.1 Team-Based Rewards
- [ ] Design team challenge reward systems
- [ ] Implement collective team goal rewards
- [ ] Create team participation bonuses
- [ ] Build team leaderboard rewards

### 4.2 Gamification Enhancements
- [ ] Add subscription-exclusive badges
- [ ] Create premium achievement tiers
- [ ] Implement team loyalty rewards
- [ ] Build seasonal reward campaigns

### 4.3 Social Features
- [ ] Enhance team chat with subscriber perks
- [ ] Add exclusive captain tools/features
- [ ] Create subscriber-only team events
- [ ] Implement team switching cooldown periods

---

## Phase 5: Advanced Features & Optimization
**Duration**: 2-3 weeks

### 5.1 Analytics & Monitoring
- [ ] Build subscription analytics dashboard
- [ ] Implement reward distribution monitoring
- [ ] Create churn prediction and retention tools
- [ ] Add financial reporting for rewards

### 5.2 Advanced Wallet Features
- [ ] Implement wallet-to-wallet transfers between users
- [ ] Add external wallet connectivity
- [ ] Create spending/earning insights
- [ ] Build wallet security enhancements

### 5.3 Subscription Management
- [ ] Add subscription pause/resume functionality
- [ ] Implement plan upgrade/downgrade flows
- [ ] Create bulk subscription management tools
- [ ] Add subscription gifting features

---

## Technical Requirements

### Environment Variables Needed
```bash
# Reward Distribution NWC
REWARD_NWC_CONNECTION_STRING=nostr+walletconnect://...

# Subscription Payment Reception NWC  
SUBSCRIPTION_NWC_CONNECTION_STRING=nostr+walletconnect://...

# Reward calculation limits
MAX_MONTHLY_REWARDS=3000
MIN_ACTIVITY_DISTANCE=0.25
```

### Database Schema Additions
- `user_subscriptions` table
- `reward_transactions` table  
- `team_switches` table
- `captain_payouts` table
- `wallet_instances` table

### Key Integration Points
- Existing NDK/Nostr infrastructure
- Current team management system
- Run tracking and activity validation
- Existing user authentication flow

---

## Success Metrics

### Phase 1-2 KPIs
- Subscription conversion rate from free users
- Team joining rate among subscribers
- Wallet creation success rate

### Phase 3-4 KPIs  
- Daily reward distribution volume
- User retention post-subscription
- Team activity engagement levels
- Captain recruitment and retention

### Phase 5 KPIs
- Monthly recurring revenue growth
- Reward system fraud/abuse rate
- Advanced feature adoption rates
- Overall platform profitability

---

## Risk Mitigation

### Technical Risks
- NIP-60 wallet implementation complexity
- NWC connection reliability  
- Reward distribution scaling issues
- Database performance under load

### Business Risks
- Subscription price sensitivity
- Reward economy sustainability
- Team captain churn
- Competitive response

### Security Risks
- Wallet security vulnerabilities
- Reward fraud and gaming
- Payment processing failures
- Data privacy compliance

---

## Next Steps

1. **Validate NIP-60 Implementation**: Review existing code and test wallet functionality
2. **Design Database Schema**: Create detailed subscription and rewards data models  
3. **Set up NWC Infrastructure**: Configure reward distribution and payment reception
4. **Build MVP Subscription Flow**: Start with basic monthly subscription implementation
5. **Create Phased Development Timeline**: Break each phase into weekly sprints

This roadmap provides a structured approach to building RUNSTR's subscription ecosystem while maintaining development momentum and user experience quality.