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

## Next Steps - The Right Fix

### Store Amber Pubkey in localStorage
- [ ] Modify AmberAuth.processDeepLink() to store pubkey in localStorage 'userPublicKey'
- [ ] Keep it simple - just add the storage, don't over-engineer

### Test Against Real Expectations  
- [ ] Verify that profile tab can find pubkey in localStorage
- [ ] Check that other parts of app (runPublisher, streakUtils) work

## Lessons Learned

1. **Understand the full context** - The working version had multiple auth methods, not just Amber
2. **Check dependencies** - Many parts of the app expect localStorage pubkey storage
3. **Don't just revert** - The Amber-only consolidation created a new requirement (localStorage storage)
4. **Root cause first** - The issue wasn't persistence patterns, it was missing persistence entirely