# NIP60 Ecash Wallet Implementation - Brainstorm

## Understanding the Transition: NWC → NIP60 Ecash

### Current State Analysis
- **NWC Integration**: Lightning-based wallet connection via nostr+walletconnect URLs
- **Payment Flow**: NWC → Lightning invoices → Lightning Network settlement
- **Zap System**: Traditional Lightning zaps with 9734 events
- **Rewards System**: Pays Lightning to resolved lightning addresses
- **UI Pattern**: Connection string input → Connect → Payment functions

### NIP60 Ecash Target State
- **Ecash Integration**: Cashu token-based wallet stored in Nostr events
- **Payment Flow**: Cashu mint → Ecash tokens → Private transfers
- **Zap System**: Nutzaps (NIP61) using ecash tokens instead of Lightning
- **Rewards System**: Distribute ecash tokens directly
- **UI Pattern**: Mint selection → Token management → Spending interface

---

## Key Questions & Considerations

### 1. **Transition Strategy**
**Question**: Do you want to replace NWC entirely or offer both options?

**Options**:
- **A. Complete Replacement**: Remove NWC, go full ecash
  - *Pros*: Simpler codebase, clear direction, privacy-first
  - *Cons*: Users lose Lightning connectivity, smaller ecosystem initially
  
- **B. Dual Wallet System**: Offer both NWC and ecash wallets
  - *Pros*: User choice, gradual migration, broader compatibility
  - *Cons*: More complex UI, dual payment logic, maintenance overhead
  
- **C. Hybrid Approach**: Ecash primary, Lightning fallback
  - *Pros*: Best of both worlds, smooth UX
  - *Cons*: Complex implementation, potential user confusion

### 2. **Cashu Mint Selection & Management**
**Question**: How should users interact with Cashu mints?

**Considerations**:
- **Trust Model**: Users must trust mint operators (vs trustless Lightning)
- **Mint Discovery**: How do users find/select reputable mints?
- **Multi-Mint Strategy**: Support multiple mints for redundancy?
- **Default Mint**: Should RUNSTR recommend/operate a default mint?

**Options**:
- **A. Single Trusted Mint**: RUNSTR partners with one reliable mint
- **B. User-Selected Mints**: Users paste mint URLs (like current NWC flow)
- **C. Curated Mint List**: RUNSTR maintains a list of recommended mints
- **D. Mint Discovery Protocol**: Implement automatic mint discovery

### 3. **Token Storage & State Management**
**Question**: How should ecash tokens be stored and managed?

**Current**: NWC handles all wallet state externally
**Ecash**: App must manage token storage, proofs, and spending

**Storage Options**:
- **A. Nostr Events (NIP60)**: Store encrypted tokens in kind:37375 events
  - *Pros*: Follows standard, sync across devices, backup via relays
  - *Cons*: Relay dependency, encryption complexity, size limits
  
- **B. Local Storage**: Keep tokens in localStorage like current transaction history
  - *Pros*: Simple implementation, fast access
  - *Cons*: No sync, lost if app data cleared, no backup
  
- **C. Hybrid**: Critical tokens in Nostr, cache in localStorage
  - *Pros*: Best performance + backup
  - *Cons*: Sync complexity, potential inconsistencies

### 4. **Rewards System Integration**
**Question**: How should the rewards system adapt to ecash?

**Current Flow**: Calculate reward → Resolve Lightning address → Send Lightning payment
**Ecash Options**:

- **A. Direct Token Distribution**: Mint tokens directly to user's ecash wallet
  - *Pros*: Instant, private, no Lightning dependency
  - *Cons*: Requires RUNSTR to hold mint tokens, liquidity management
  
- **B. Reward Vouchers**: Issue redeemable vouchers that users can claim
  - *Pros*: Simple for RUNSTR, user controls when to claim
  - *Cons*: Extra step for users, voucher management complexity
  
- **C. Hybrid Rewards**: Let users choose Lightning or ecash rewards
  - *Pros*: Maximum flexibility
  - *Cons*: Dual implementation, UI complexity

### 5. **Zap System Evolution**
**Question**: How should zapping work with ecash?

**Options**:
- **A. Pure Nutzaps (NIP61)**: Replace Lightning zaps with ecash token transfers
- **B. Zap Conversion**: Convert ecash to Lightning for zapping
- **C. Dual Zap Types**: Support both Lightning and ecash zaps

---

## Implementation Approaches

### Approach 1: **Simple Replacement** (Recommended for MVP)
```
Current:     [NWC] → [Lightning] → [Zaps/Rewards]
New:         [Cashu] → [Ecash] → [Nutzaps/Rewards]
```

**Characteristics**:
- Replace NWCWalletConnector with CashuWalletConnector
- Replace Lightning payment logic with ecash spending
- Update rewards system to distribute tokens
- Modify zap system to use NIP61 nutzaps

**Pros**: Clean, focused, privacy-first
**Cons**: Breaking change, smaller ecosystem initially

### Approach 2: **Gradual Migration**
```
Phase 1:     [NWC] + [Cashu] (dual wallet UI)
Phase 2:     [Cashu] primary, [NWC] optional
Phase 3:     [Cashu] only
```

**Characteristics**:
- Add ecash wallet alongside existing NWC
- Let users gradually migrate funds/usage
- Maintain both payment paths during transition
- Eventually deprecate NWC

**Pros**: Smooth user experience, no forced migration
**Cons**: Complex implementation, longer development time

### Approach 3: **Hybrid Architecture**
```
Wallet Layer:    [Unified Wallet Interface]
             ↙                        ↘
     [Cashu Backend]              [NWC Backend]
```

**Characteristics**:
- Abstract wallet interface in UI
- Runtime switching between backends
- Automatic fallback mechanisms
- Unified transaction history

**Pros**: Maximum flexibility, robust
**Cons**: High complexity, potential confusion

---

## Technical Implementation Questions

### 1. **Cashu Library Integration**
- Which Cashu library to use? (cashu-ts, cashu-js, or custom?)
- How to handle async token operations in React?
- Error handling for mint communication failures?

### 2. **NIP60 Event Management**
- How to handle event encryption/decryption?
- Relay selection for wallet events?
- Conflict resolution for concurrent token operations?

### 3. **UI/UX Patterns**
- How to show token balances vs Lightning balances?
- Visual indicators for ecash vs Lightning transactions?
- Mint status/health indicators?
- Token expiry warnings?

### 4. **Security Considerations**
- Key management for NIP60 encryption?
- Secure token storage patterns?
- Protection against double-spending?
- Backup/recovery mechanisms?

---

## Recommendations

### For **Simple Start** (MVP):
1. **Choose Approach 1**: Complete replacement for focused development
2. **Single Mint Strategy**: Partner with one reliable mint initially
3. **Local + Nostr Storage**: Store tokens in both for performance + backup
4. **Replace Current Flows**: Modify existing components rather than rebuilding

### For **Production Ready**:
1. **Choose Approach 2**: Gradual migration for user adoption
2. **Curated Mint List**: Offer 3-5 trusted mint options
3. **Comprehensive Error Handling**: Robust fallback mechanisms
4. **User Education**: Clear documentation on ecash vs Lightning tradeoffs

### Next Steps:
1. **Clarify Your Priorities**: Privacy vs compatibility vs simplicity?
2. **Choose Mint Strategy**: Will you run a mint or partner with existing ones?
3. **Define Success Metrics**: What makes this transition successful?
4. **Prototype Key Flows**: Token storage, spending, and rewards distribution

---

## Questions for You:

1. **What's driving this transition?** Privacy, sovereignty, or technical benefits?
2. **How important is maintaining Lightning compatibility** for your users?
3. **Are you willing to run/operate a Cashu mint** or prefer to use existing ones?
4. **What's your timeline?** MVP in weeks or comprehensive solution over months?
5. **How tech-savvy are your users?** Will they understand ecash concepts?
6. **Should rewards still be "real Bitcoin"** or is ecash sufficient for the rewards system?

*Let me know your thoughts on these questions and I can help you dive deeper into the specific areas that matter most for your app!*

---

## 🎯 SIMPLIFIED EVENT-DRIVEN APPROACH
*Based on Core Issues Analysis - January 2025*

### The Fundamental Shift: From Service to Events

**Current Problem**: You're treating NIP-60 like a wallet service with methods like `getBalance()`, `send()`, `connect()`
**Simple Solution**: Treat it as what it actually is - a collection of Nostr events

### Core Principle: Everything is an Event Query

Instead of:
```
wallet.getBalance() → API call to wallet service
```

Think:
```
calculateBalance() → Query Nostr for token events and sum them
```

### Three-Component Architecture

#### 1. **Event Manager** (Pure Nostr)
- Publishes wallet creation events (kind:17375)
- Publishes mint lists (kind:10019) 
- Queries for existing wallet events
- Monitors for incoming token events
- **No wallet object abstraction**

#### 2. **Token Calculator** (Pure Math)
- Sums token values from events
- Tracks spent vs unspent tokens
- Calculates balance on-demand
- **No stored balance state**

#### 3. **UI State** (React Only)
- Loading states for queries
- Error states for failures
- User input handling
- **No complex wallet state**

---

### Simplified Flow Examples

#### "Connecting" a Wallet (Discovery)
```
Current:  wallet.connect() → Complex connection logic
Simple:   queryWalletEvents(userPubkey) → [kind:17375, kind:10019 events]
```

#### Checking Balance  
```
Current:  await wallet.getBalance() → Method doesn't exist
Simple:   const balance = sumTokensFromEvents(tokenEvents)
```

#### Sending Tokens
```
Current:  wallet.send(amount) → Complex wallet method
Simple:   publishTokenEvent(recipientPubkey, tokenData)
```

#### Receiving Tokens
```
Current:  wallet.receiveToken(token) → Wallet abstraction
Simple:   subscribeToTokenEvents(myPubkey) → Process new events
```

---

### Implementation Strategy: Remove All Abstractions

#### Phase 1: Replace Wallet Objects with Event Queries
- Delete `EcashWalletContext` complexity
- Replace with simple `useWalletEvents` hook
- Query events directly in components
- Calculate everything on-demand

#### Phase 2: Event-Based State Management
- `walletEvents` - Array of kind:17375 events
- `mintEvents` - Array of kind:10019 events  
- `tokenEvents` - Array of token proof events
- `loading` - Boolean for query states
- `error` - String for error messages

#### Phase 3: Direct Event Publishing
- Create token events directly with NDK
- Publish to relays immediately
- Monitor subscriptions for incoming events
- No complex wallet method calls

---

### Why This Approach Works Better

#### Alignment with Nostr Philosophy
- **Event-First**: Everything is an event, not a service call
- **Query-Based**: Discover state through queries, don't store it
- **Relay-Native**: Work directly with relays, not abstracted APIs
- **User-Controlled**: Users control their events, not wallet services

#### Simplification Benefits
- **No Method Guessing**: Stop wondering if `getBalance()` exists
- **No Connection State**: No "connected" vs "disconnected" complexity  
- **No API Abstractions**: Work directly with what NIP-60 actually provides
- **Event-Driven UI**: React to event changes, not wallet state changes

#### Debugging Advantages
- **Transparent**: See exactly what events exist
- **Traceable**: Follow event publishing and queries
- **Testable**: Mock events instead of complex wallet objects
- **Understandable**: Clear cause and effect

---

### Practical Implementation Questions

#### For Event Queries:
- Which relays should we query for wallet events?
- How long should we cache event results?
- How do we handle relay failures during queries?

#### For Token Management:
- How do we track which tokens have been spent?
- Should we store spent token IDs in local storage?
- How do we handle token expiry?

#### For UI Patterns:
- Show loading states during event queries?
- Display balance as "calculated from X events"?
- Refresh button to re-query events?

#### For Error Handling:
- What happens when no wallet events are found?
- How do we handle invalid token events?
- Should we retry failed event publishing?

---

### Next Steps for Simplified Implementation

1. **Audit Current Code**: Identify all wallet method calls that don't actually exist
2. **Map to Events**: For each wallet operation, identify the corresponding Nostr events
3. **Create Event Utilities**: Simple functions for querying/publishing each event type
4. **Replace Components**: Update UI components to use event queries instead of wallet methods
5. **Test with Events**: Verify everything works by inspecting actual Nostr events

---

### Key Questions for This Approach:

1. **Are you ready to abandon the "wallet object" mental model** in favor of pure event queries?
2. **Should balance be calculated fresh every time** or cached for performance?
3. **How much complexity are you willing to remove** vs keeping for user experience?
4. **Do you want to see actual Nostr events in the UI** for transparency/debugging?

This simplified approach eliminates the confusion between what NIP-60 actually provides (events) versus what you're trying to use (traditional wallet APIs). It makes your code more Nostr-native and much easier to debug and understand. 

---

## 🛠️ PRACTICAL FIX GUIDE: From Broken Methods to Working Events

*Direct solutions for your current code issues*

### Current Broken Code → Simple Event-Based Fix

#### Problem 1: `wallet.getBalance()` doesn't exist
**Current broken code:**
```javascript
const currentBalance = await cashuWallet.getBalance() || 0;  // ❌ Method doesn't exist
```

**Event-based fix:**
```javascript
// Query token events and calculate balance
const calculateBalance = async (userPubkey) => {
  const tokenEvents = await ndk.fetchEvents({
    kinds: [7376], // Cashu token events
    authors: [userPubkey],
    limit: 100
  });
  
  let balance = 0;
  tokenEvents.forEach(event => {
    try {
      const tokenData = JSON.parse(event.content);
      balance += tokenData.amount || 0;
    } catch (e) {
      console.warn('Invalid token event:', e);
    }
  });
  
  return balance;
};

// Usage:
const balance = await calculateBalance(user.pubkey);
```

#### Problem 2: Complex wallet "connection" logic
**Current broken code:**
```javascript
await cashuWallet.start();  // ❌ Unclear what this does
await cashuWallet.publish(); // ❌ Treating like service
```

**Event-based fix:**
```javascript
// Simple wallet discovery
const findExistingWallet = async (userPubkey) => {
  const walletEvents = await ndk.fetchEvents({
    kinds: [17375], // Wallet metadata
    authors: [userPubkey],
    limit: 1
  });
  
  const mintEvents = await ndk.fetchEvents({
    kinds: [10019], // Mint lists  
    authors: [userPubkey],
    limit: 1
  });
  
  return {
    hasWallet: walletEvents.size > 0,
    walletEvent: Array.from(walletEvents)[0],
    mintEvent: Array.from(mintEvents)[0]
  };
};
```

#### Problem 3: Non-existent send methods
**Current broken code:**
```javascript
const token = await wallet.mintTokens(amount); // ❌ May not exist
await wallet.send(amount); // ❌ Inconsistent API
```

**Event-based fix:**
```javascript
// Create token transfer event
const sendToken = async (recipientPubkey, amount, mintUrl) => {
  const tokenEvent = new NDKEvent(ndk);
  tokenEvent.kind = 7376; // Cashu token event
  tokenEvent.content = JSON.stringify({
    mint: mintUrl,
    amount: amount,
    token: "cashuAbc123...", // Actual cashu token string
    type: "send"
  });
  tokenEvent.tags = [
    ['p', recipientPubkey], // Recipient
    ['mint', mintUrl],
    ['amount', amount.toString()]
  ];
  
  await tokenEvent.publish();
  
  // Also send via DM for immediate notification
  const dmEvent = new NDKEvent(ndk);
  dmEvent.kind = 4;
  dmEvent.content = `Ecash token: cashuAbc123...`;
  dmEvent.tags = [['p', recipientPubkey]];
  await dmEvent.encrypt(recipientPubkey);
  await dmEvent.publish();
};
```

### Simplified Component Structure

#### Replace Complex Context with Simple Hook
**Instead of:** Complex `EcashWalletContext` with 20+ state variables

**Use:** Simple event-based hook:
```javascript
// useWalletEvents.js
export const useWalletEvents = () => {
  const { ndk, user } = useContext(NostrContext);
  const [events, setEvents] = useState({
    wallet: null,
    mints: [],
    tokens: [],
    loading: false,
    error: null
  });

  // Load all wallet events
  const loadWalletData = async () => {
    if (!user) return;
    
    setEvents(prev => ({ ...prev, loading: true }));
    
    try {
      // Query all relevant events in parallel
      const [walletEvents, mintEvents, tokenEvents] = await Promise.all([
        ndk.fetchEvents({ kinds: [17375], authors: [user.pubkey] }),
        ndk.fetchEvents({ kinds: [10019], authors: [user.pubkey] }),
        ndk.fetchEvents({ kinds: [7376], authors: [user.pubkey], limit: 50 })
      ]);

      setEvents({
        wallet: Array.from(walletEvents)[0] || null,
        mints: Array.from(mintEvents),
        tokens: Array.from(tokenEvents),
        loading: false,
        error: null
      });
    } catch (error) {
      setEvents(prev => ({ ...prev, loading: false, error: error.message }));
    }
  };

  // Calculate balance from events
  const balance = useMemo(() => {
    return events.tokens.reduce((total, event) => {
      try {
        const data = JSON.parse(event.content);
        return total + (data.amount || 0);
      } catch {
        return total;
      }
    }, 0);
  }, [events.tokens]);

  return { ...events, balance, loadWalletData };
};
```

#### Simplified Wallet Component
```javascript
// EcashWallet.jsx
export const EcashWallet = () => {
  const { wallet, mints, tokens, balance, loading, loadWalletData } = useWalletEvents();
  const [selectedMint, setSelectedMint] = useState('');

  useEffect(() => {
    loadWalletData();
  }, []);

  const createWallet = async () => {
    // Just publish wallet events directly
    const walletEvent = new NDKEvent(ndk);
    walletEvent.kind = 17375;
    walletEvent.content = JSON.stringify({
      name: "RUNSTR Wallet",
      mints: [selectedMint]
    });
    await walletEvent.publish();

    const mintEvent = new NDKEvent(ndk);
    mintEvent.kind = 10019;
    mintEvent.content = JSON.stringify({
      mints: [{ url: selectedMint, units: ['sat'] }]
    });
    await mintEvent.publish();

    // Reload events
    loadWalletData();
  };

  if (loading) return <div>Loading wallet events...</div>;
  
  if (!wallet) {
    return (
      <div>
        <select value={selectedMint} onChange={(e) => setSelectedMint(e.target.value)}>
          <option value="">Select a mint</option>
          <option value="https://mint.coinos.io">CoinOS</option>
          <option value="https://mint.minibits.cash/Bitcoin">Minibits</option>
        </select>
        <button onClick={createWallet} disabled={!selectedMint}>
          Create Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h3>Ecash Wallet</h3>
      <p>Balance: {balance} sats</p>
      <p>Events: {tokens.length} token events found</p>
      <button onClick={loadWalletData}>Refresh</button>
    </div>
  );
};
```

### Benefits of This Approach

#### What You Eliminate:
- ❌ Guessing which wallet methods exist  
- ❌ Complex connection state management
- ❌ Wallet object abstractions that don't match NIP-60
- ❌ Balance stored in React state (calculate from events instead)
- ❌ 500+ lines of complex context code

#### What You Gain:
- ✅ Direct control over Nostr events
- ✅ Transparent debugging (see actual events)
- ✅ Simpler state management (events + loading + error)
- ✅ Easier testing (mock events, not complex objects)
- ✅ True NIP-60 compliance (event-based, not service-based)

### Immediate Action Steps:

1. **Replace `wallet.getBalance()`** → `calculateBalance(events)`
2. **Replace `wallet.start()`** → `loadWalletEvents()`  
3. **Replace `wallet.send()`** → `publishTokenEvent()`
4. **Replace complex context** → `useWalletEvents` hook
5. **Show events in UI** for transparency and debugging

This approach treats NIP-60 as what it actually is: a specification for storing wallet data as Nostr events, not a traditional wallet service API. 

---

## 🚀 COMPLETE REPLACEMENT IMPLEMENTATION PLAN

*Step-by-step guide to replace current broken implementation*

### Implementation Strategy Overview

**Goal**: Replace all NDKCashuWallet abstractions with direct Nostr event queries
**Approach**: Complete replacement - delete complex context, create simple event-based system
**Auto-Discovery**: Find existing NIP-60 events on user connection, create if none exist

### Phase 1: Core Event Utilities (Foundation)

Create `src/utils/nip60Events.js` - All NIP-60 operations without wallet abstractions

**Key Functions:**
- `findWalletEvents(ndk, userPubkey)` - Query for kind:17375 & kind:10019 
- `createWalletEvents(ndk, mintUrl)` - Publish new wallet events
- `queryTokenEvents(ndk, userPubkey)` - Get token events for balance
- `calculateBalance(tokenEvents)` - Sum tokens from events

### Phase 2: Simple React Hook 

Create `src/hooks/useNip60Wallet.js` - Replace EcashWalletContext

**State Management:**
```javascript
const [walletState, setWalletState] = useState({
  walletEvent: null,    // kind:17375 event
  mintEvent: null,      // kind:10019 event  
  tokenEvents: [],      // kind:7376 events
  loading: false,
  error: null,
  isInitialized: false
});
```

**Auto-Discovery Logic:**
1. On user connection, query for existing wallet events
2. If found: Load wallet + mint + token events
3. If not found: Show mint selection UI for wallet creation
4. Balance calculated from token events (not stored state)

### Phase 3: Simplified Components

Replace `src/pages/EcashWallet.jsx` with event-driven UI:

**Wallet Discovery Flow:**
```
Loading → Query Events → Found? → Show Wallet
                     ↘ Not Found? → Show Creation UI
```

**Creation Flow:**
```
Select Mint → Create Events → Reload → Show Wallet
```

### Phase 4: Cleanup

**Delete These Files:**
- `src/contexts/EcashWalletContext.jsx` (500+ lines of complexity)
- `src/components/EcashWalletConnector.jsx` (moved to main page)  
- `src/services/ecashWalletService.js` (replaced by utilities)

### Phase 5: Key Implementation Details

#### Event Types Used:
- **kind:17375** - Wallet metadata (name, mints, version)
- **kind:10019** - Mint list (supported mints for receiving)
- **kind:7376** - Token events (for balance calculation)

#### Auto-Discovery Process:
```javascript
// 1. Check for existing wallet
const walletData = await findWalletEvents(ndk, user.pubkey);

// 2. If found, load everything
if (walletData.hasWallet) {
  const tokens = await queryTokenEvents(ndk, user.pubkey);
  const balance = calculateBalance(tokens);
  // Show wallet UI
}

// 3. If not found, show creation
else {
  // Show mint selection for new wallet
}
```

#### Wallet Creation Process:
```javascript
// 1. User selects mint
// 2. Publish wallet metadata event
const walletEvent = new NDKEvent(ndk);
walletEvent.kind = 17375;
walletEvent.content = JSON.stringify({
  name: "RUNSTR Ecash Wallet",
  mints: [selectedMintUrl]
});

// 3. Publish mint list event  
const mintEvent = new NDKEvent(ndk);
mintEvent.kind = 10019;
mintEvent.content = JSON.stringify({
  mints: [{ url: selectedMintUrl, units: ['sat'] }]
});

// 4. Publish both events
await Promise.all([walletEvent.publish(), mintEvent.publish()]);
```

### Benefits of This Implementation:

✅ **Auto-Discovery**: Finds existing wallets automatically
✅ **Auto-Creation**: Creates wallet if none exists  
✅ **Event-Driven**: Pure Nostr event queries, no broken methods
✅ **Transparent**: Shows actual events and balance calculation
✅ **Simple State**: Just events + loading + error
✅ **No Abstractions**: Direct control over Nostr events
✅ **Debuggable**: Clear event data visible in UI

### Next Steps:

1. Create the event utilities first (`nip60Events.js`)
2. Build the hook (`useNip60Wallet.js`)  
3. Update the main wallet page
4. Test auto-discovery with existing events
5. Test wallet creation flow
6. Clean up old files

This completely eliminates the broken `NDKCashuWallet` method calls and replaces them with reliable Nostr event operations. 