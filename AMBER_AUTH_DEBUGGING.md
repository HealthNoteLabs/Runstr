# Amber Authentication Debugging Log

## Problem Statement
User getting "Error No user pubkey" in profile tab after Amber authentication. The app cannot find/access the authenticated user's public key.

## Timeline of Issues
- **Working Version**: `feed-0.7.0-20250804-170939` (a12999b) - Profile tab worked correctly
- **Broken After**: Amber-only consolidation commit d641da6 
- **Current Status**: Still broken even after reverting to working pattern

## Authentication Flow Analysis

### Expected Flow
1. User authenticates with Amber app
2. Amber returns pubkey via deep link callback  
3. App stores pubkey somewhere accessible
4. Profile tab retrieves pubkey and loads user data

### Current Flow Issues
- ✅ Amber authentication succeeds (user can sign events)
- ❌ Profile tab cannot find the pubkey ("Error No user pubkey")
- ❌ NostrContext.publicKey is null when profile tab loads

## Attempted Solutions & Results

### Attempt 1: Add localStorage Persistence
**What**: Added localStorage sync in NostrContext and AmberAuth
**Files**: `src/contexts/NostrContext.jsx`, `src/services/AmberAuth.js`
**Result**: ❌ Still getting "no user pubkey found" error
**Learning**: localStorage might not be the right approach for mobile WebView

### Attempt 2: Signer Restoration Logic  
**What**: Added logic to restore Amber signer when pubkey exists in localStorage
**Files**: `src/contexts/NostrContext.jsx`
**Result**: ❌ Still getting error
**Learning**: Signer restoration is unnecessary - profile tab doesn't need signing capability

### Attempt 3: Enhanced Fallback Logic
**What**: Added multiple fallback sources in useNostrRunStats (context → localStorage → AmberAuth)
**Files**: `src/hooks/useNostrRunStats.js`
**Result**: ❌ Still getting error  
**Learning**: Complex fallbacks mask the root issue

### Attempt 4: AmberAuth State Initialization
**What**: Initialize AmberAuth authenticationState from localStorage on startup
**Files**: `src/services/AmberAuth.js`
**Result**: ❌ Still getting error
**Learning**: AmberAuth in-memory state resets on app restart

### Attempt 5: Revert to Working Pattern
**What**: Reverted all changes to match working version a12999b exactly
**Files**: All authentication files reverted
**Result**: ❌ Still getting "Error No user pubkey"
**Learning**: Either the "working pattern" wasn't right, or something else changed

## Current Understanding of Pubkey Storage

### AmberAuth.js Storage
```javascript
// In-memory only - resets on app restart
let authenticationState = { isLoggedIn: false, publicKey: null };

// Gets set in processDeepLink() when Amber responds
authenticationState.publicKey = parsed.pubkey;

// Retrieved via getCurrentPublicKey()
const getCurrentPublicKey = () => authenticationState.publicKey;
```

### NostrContext.jsx Flow
```javascript
// Amber signer setup
ndk.signer = {
  _pubkey: null,
  user: async function() {
    if (!this._pubkey) this._pubkey = await AmberAuth.getPublicKey();
    return { pubkey: this._pubkey };
  }
};

// Sets context state
const user = await ndk.signer.user();
setPublicKeyInternal(user.pubkey);
```

### useNostrRunStats.js Check
```javascript
// Simple check - expects context to have pubkey
if (!userPubkey) {
  setError('No user pubkey');
  return;
}
```

## Key Questions to Resolve

1. **Where should pubkey persist across app restarts?**
   - Currently: In-memory only (lost on restart)
   - Options: localStorage, Capacitor Preferences, other?

2. **When exactly does Amber store the pubkey?**
   - In processDeepLink() callback only?
   - Does it persist anywhere permanent?

3. **How did the working version handle app restarts?**
   - Did users re-authenticate each time?
   - Was there hidden persistence we missed?

4. **Is the authentication actually completing?**
   - Maybe the deep link callback isn't firing?
   - Maybe processDeepLink() isn't storing the pubkey?

## Next Steps to Try

### Debug Current State
- [ ] Add logging to see if processDeepLink() ever gets called
- [ ] Check if authenticationState.publicKey gets set during auth
- [ ] Verify NostrContext.publicKey state after authentication
- [ ] Confirm which error message is showing ("Error No user pubkey" vs longer message)

### Find Real Storage Location
- [ ] Search codebase for any other pubkey storage mechanisms
- [ ] Check if Capacitor has native storage being used
- [ ] Look for any other authentication state management

### Test Working Version
- [ ] Check out a12999b and test if it actually works on fresh app install
- [ ] Compare exact behavior between working and broken versions

## 🎯 **BREAKTHROUGH: Root Cause Identified**

### The Real Problem
The working version a12999b had **3 authentication methods**:
1. **Private Key** - Stored in localStorage 'runstr_privkey' ✅ Persistent
2. **NIP-07 Browser Extension** - Could store pubkey ✅ Persistent  
3. **Amber** - In-memory only ❌ Lost on restart

The Amber-only consolidation (commit d641da6) **removed the persistent auth methods** and left only Amber, which doesn't persist the pubkey!

### Evidence from Working Version
```javascript
// Private key auth - PERSISTENT
const storedPrivKey = window.localStorage.getItem('runstr_privkey');
if (storedPrivKey) {
  ndk.signer = new NDKPrivateKeySigner(storedPrivKey);
  return user.pubkey; // This persists across restarts
}

// Amber auth - NOT PERSISTENT  
ndk.signer = {
  _pubkey: null,
  user: async function() {
    if (!this._pubkey) this._pubkey = await AmberAuth.getPublicKey();
    return { pubkey: this._pubkey };
  }
};
```

### Throughout Codebase
Many utilities expect pubkey in localStorage:
- `runPublisher.js`: `localStorage.getItem('userPublicKey')`
- `useRunStats.js`: `localStorage.getItem('userPubkey')`
- `streakUtils.ts`: Multiple localStorage key checks

### Real Solution
**Amber authentication MUST store pubkey in localStorage** like the other auth methods did.

## 🚨 **NEW HYPOTHESIS: The Flow Is Broken**

Since localStorage persistence didn't work, the issue might be deeper:

### Possible Issues
1. **Deep link callback not firing** - processDeepLink() might not be called
2. **Timing issue** - Profile tab loads before authentication completes
3. **NostrContext not updating** - localStorage exists but context doesn't read it
4. **Different error source** - "Error: No user pubkey" might come from somewhere else

### Debug Strategy
Need to trace the EXACT flow:
1. Does Amber authentication actually call processDeepLink()?
2. Does localStorage actually get the pubkey stored?
3. Does NostrContext.publicKey get set from the signer?
4. Does useNostrRunStats receive a non-null userPubkey?

## Next Steps - Debug The Flow

### Store Amber Pubkey in localStorage
- [x] Modify AmberAuth.processDeepLink() to store pubkey in localStorage 'userPublicKey'
- [x] Keep it simple - just add the storage, don't over-engineer
- ❌ **RESULT**: Still getting "Error: No user pubkey"

### Test Against Real Expectations  
- [ ] Verify that profile tab can find pubkey in localStorage
- [ ] Check that other parts of app (runPublisher, streakUtils) work

## Attempt 6: Add localStorage Persistence to AmberAuth
**Commit**: 08fef1f
**What**: Made Amber authentication store pubkey in localStorage like other auth methods
**Changes**:
- AmberAuth.processDeepLink(): Store pubkey when deep link succeeds
- AmberAuth initialization: Load from localStorage on startup
- clearAuthenticationState(): Remove from localStorage on logout
**Result**: ❌ Still getting "Error: No user pubkey"
**Learning**: localStorage storage alone isn't sufficient - there's still a disconnect

## Attempt 7: Add Console Debugging (Failed)
**What**: Added comprehensive console.log debugging throughout AmberAuth and NostrContext
**Problem**: Can't see console logs on Android device - debugging approach invalid
**Learning**: Need different debugging strategy for mobile

## Attempt 8: Direct localStorage Fallback in Profile Hook
**What**: Instead of relying on NostrContext, added direct localStorage fallback in useNostrRunStats
**Changes**: 
- useNostrRunStats: Check context first, then localStorage 'userPublicKey' directly
- Removed all console.log debugging (won't work on Android)
**Rationale**: If Amber stores pubkey in localStorage but context doesn't get it, bypass the context
**Result**: ❌ Still getting "Error: No user pubkey"
**Learning**: Band-aid approach doesn't fix the root cause

## 🎯 **COMPREHENSIVE ROOT CAUSE ANALYSIS** (Deep Dive)

### The Real Problem: Broken Authentication Persistence Pattern

**What SHOULD happen (like private key auth worked):**
1. User authenticates once → pubkey stored in localStorage
2. App restart → NostrContext immediately loads stored pubkey → sets context state
3. Profile tab loads → gets pubkey from context → works ✅

**What ACTUALLY happens (broken Amber flow):**
1. User authenticates → pubkey stored correctly in localStorage ✅
2. App restart → NostrContext sets up lazy signer but **never checks stored pubkey** ❌
3. Context publicKey remains null until signer is explicitly called ❌
4. Profile tab loads → context pubkey null → shows error ❌
5. When signer IS called → **triggers NEW authentication** instead of using stored pubkey ❌

### Specific Technical Bugs Identified:

**Bug 1: NostrContext.attachSigner() Missing Amber Pubkey Check**
- Lines 14-29 check for private key and immediately set context pubkey
- Lines 32-56 set up Amber signer but **never check AmberAuth.getCurrentPublicKey()**
- Should follow same pattern as private key: check stored pubkey → set context immediately

**Bug 2: AmberAuth.getPublicKey() Always Re-authenticates** 
- Lines 115-167 always create new authentication request
- Should check `authenticationState.publicKey` first and return it if available
- Only trigger new auth flow if no stored pubkey exists

**Bug 3: No Context State Update After Authentication**
- processDeepLink() stores pubkey but NostrContext never knows auth completed
- Context publicKey state remains null even after successful authentication

### Why User Experiences 60s Timeout:
Every time app needs pubkey, lazy signer calls getPublicKey() → opens Amber → waits 30s → if user doesn't complete, timeout → pubkey remains null

## Lessons Learned

1. **Understand the full context** - The working version had multiple auth methods, not just Amber
2. **Check dependencies** - Many parts of the app expect localStorage pubkey storage
3. **Don't just revert** - The Amber-only consolidation created a new requirement (localStorage storage)
4. **Root cause first** - The issue wasn't persistence patterns, it was missing persistence entirely