# NIP-60 Complete Replacement Implementation Plan

*Event-driven approach to replace broken NDKCashuWallet implementation*

## 🎯 Strategy Overview

**Goal**: Replace all NDKCashuWallet abstractions with direct Nostr event queries
**Approach**: Complete replacement - delete complex context, create simple event-based system  
**Auto-Discovery**: Find existing NIP-60 events on user connection, create if none exist

---

## 📋 Phase 1: Core Event Utilities (Foundation)

### Create `src/utils/nip60Events.js`

This will handle all NIP-60 event operations without wallet abstractions.

```javascript
// src/utils/nip60Events.js
import { NDKEvent } from '@nostr-dev-kit/ndk';

export const NIP60_KINDS = {
  WALLET_METADATA: 17375,
  MINT_LIST: 10019,
  TOKEN_EVENT: 7376, // For actual token transfers
};

export const SUPPORTED_MINTS = [
  {
    name: "CoinOS",
    url: "https://mint.coinos.io",
    description: "CoinOS community mint"
  },
  {
    name: "Minibits", 
    url: "https://mint.minibits.cash/Bitcoin",
    description: "Minibits mobile wallet mint"
  },
  {
    name: "0xchat",
    url: "https://mint.0xchat.com", 
    description: "0xchat messaging app mint"
  }
];

/**
 * Query for existing NIP-60 wallet events
 */
export const findWalletEvents = async (ndk, userPubkey) => {
  if (!ndk || !userPubkey) return null;

  try {
    // Query for wallet metadata and mint lists in parallel
    const [walletEvents, mintEvents] = await Promise.all([
      ndk.fetchEvents({
        kinds: [NIP60_KINDS.WALLET_METADATA],
        authors: [userPubkey],
        limit: 5
      }),
      ndk.fetchEvents({
        kinds: [NIP60_KINDS.MINT_LIST],
        authors: [userPubkey], 
        limit: 5
      })
    ]);

    // Get most recent events
    const latestWallet = Array.from(walletEvents)
      .sort((a, b) => b.created_at - a.created_at)[0];
    const latestMints = Array.from(mintEvents)
      .sort((a, b) => b.created_at - a.created_at)[0];

    return {
      hasWallet: walletEvents.size > 0,
      walletEvent: latestWallet,
      mintEvent: latestMints,
      walletData: latestWallet ? parseWalletEvent(latestWallet) : null,
      mintData: latestMints ? parseMintEvent(latestMints) : null
    };
  } catch (error) {
    console.error('[NIP60Events] Error finding wallet events:', error);
    return null;
  }
};

/**
 * Create new NIP-60 wallet events
 */
export const createWalletEvents = async (ndk, selectedMintUrl) => {
  if (!ndk || !ndk.signer) {
    throw new Error('NDK signer not available');
  }

  try {
    // Create wallet metadata event (kind:17375)
    const walletEvent = new NDKEvent(ndk);
    walletEvent.kind = NIP60_KINDS.WALLET_METADATA;
    walletEvent.content = JSON.stringify({
      name: "RUNSTR Ecash Wallet",
      description: "NIP-60 wallet for RUNSTR app",
      mints: [selectedMintUrl],
      version: "1.0.0",
      created_at: Math.floor(Date.now() / 1000)
    });
    walletEvent.tags = [
      ['name', 'RUNSTR Ecash Wallet'],
      ['mint', selectedMintUrl],
      ['client', 'RUNSTR']
    ];

    // Create mint list event (kind:10019) 
    const mintEvent = new NDKEvent(ndk);
    mintEvent.kind = NIP60_KINDS.MINT_LIST;
    mintEvent.content = JSON.stringify({
      mints: [{ url: selectedMintUrl, units: ['sat'] }]
    });
    mintEvent.tags = [
      ['mint', selectedMintUrl]
    ];

    // Publish both events
    console.log('[NIP60Events] Publishing wallet events...');
    await Promise.all([
      walletEvent.publish(),
      mintEvent.publish()
    ]);

    console.log('[NIP60Events] Wallet events published successfully');
    return { walletEvent, mintEvent };

  } catch (error) {
    console.error('[NIP60Events] Error creating wallet events:', error);
    throw error;
  }
};

/**
 * Query for token events (balance calculation)
 */
export const queryTokenEvents = async (ndk, userPubkey, limit = 100) => {
  if (!ndk || !userPubkey) return [];

  try {
    const tokenEvents = await ndk.fetchEvents({
      kinds: [NIP60_KINDS.TOKEN_EVENT],
      authors: [userPubkey],
      limit
    });

    return Array.from(tokenEvents).map(event => ({
      id: event.id,
      created_at: event.created_at,
      content: parseTokenEvent(event),
      rawEvent: event
    }));
  } catch (error) {
    console.error('[NIP60Events] Error querying token events:', error);
    return [];
  }
};

/**
 * Calculate balance from token events
 */
export const calculateBalance = (tokenEvents) => {
  return tokenEvents.reduce((total, event) => {
    try {
      const amount = event.content?.amount || 0;
      const type = event.content?.type || 'receive';
      
      // Add for receives, subtract for sends
      return type === 'send' ? total - amount : total + amount;
    } catch (error) {
      console.warn('[NIP60Events] Invalid token event:', error);
      return total;
    }
  }, 0);
};

/**
 * Helper functions for parsing events
 */
const parseWalletEvent = (event) => {
  try {
    return JSON.parse(event.content);
  } catch (error) {
    console.warn('[NIP60Events] Failed to parse wallet event:', error);
    return null;
  }
};

const parseMintEvent = (event) => {
  try {
    return JSON.parse(event.content);
  } catch (error) {
    console.warn('[NIP60Events] Failed to parse mint event:', error);
    return null;
  }
};

const parseTokenEvent = (event) => {
  try {
    return JSON.parse(event.content);
  } catch (error) {
    console.warn('[NIP60Events] Failed to parse token event:', error);
    return { amount: 0, type: 'unknown' };
  }
};
```

---

## 🎣 Phase 2: Simple React Hook (State Management)

### Create `src/hooks/useNip60Wallet.js`

Replace the complex EcashWalletContext with this simple hook.

```javascript
// src/hooks/useNip60Wallet.js
import { useState, useEffect, useContext, useMemo } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { 
  findWalletEvents, 
  createWalletEvents, 
  queryTokenEvents, 
  calculateBalance,
  SUPPORTED_MINTS 
} from '../utils/nip60Events';

export const useNip60Wallet = () => {
  const { ndk, user } = useContext(NostrContext);
  
  // Simple state - just events and loading
  const [walletState, setWalletState] = useState({
    walletEvent: null,
    mintEvent: null,
    tokenEvents: [],
    loading: false,
    error: null,
    isInitialized: false
  });

  // Auto-discover wallet on user connection
  useEffect(() => {
    if (ndk && user && !walletState.isInitialized) {
      discoverWallet();
    }
  }, [ndk, user, walletState.isInitialized]);

  /**
   * Auto-discover existing wallet or show creation UI
   */
  const discoverWallet = async () => {
    setWalletState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('[NIP60Wallet] Discovering existing wallet...');
      const walletData = await findWalletEvents(ndk, user.pubkey);
      
      if (walletData && walletData.hasWallet) {
        console.log('[NIP60Wallet] Found existing wallet');
        
        // Load token events for balance calculation
        const tokens = await queryTokenEvents(ndk, user.pubkey);
        
        setWalletState({
          walletEvent: walletData.walletEvent,
          mintEvent: walletData.mintEvent,
          tokenEvents: tokens,
          loading: false,
          error: null,
          isInitialized: true
        });
      } else {
        console.log('[NIP60Wallet] No existing wallet found');
        setWalletState({
          walletEvent: null,
          mintEvent: null,
          tokenEvents: [],
          loading: false,
          error: null,
          isInitialized: true
        });
      }
    } catch (error) {
      console.error('[NIP60Wallet] Discovery error:', error);
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: error.message,
        isInitialized: true
      }));
    }
  };

  /**
   * Create new wallet with selected mint
   */
  const createWallet = async (selectedMintUrl) => {
    if (!selectedMintUrl) {
      throw new Error('Mint URL is required');
    }

    setWalletState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('[NIP60Wallet] Creating new wallet...');
      const { walletEvent, mintEvent } = await createWalletEvents(ndk, selectedMintUrl);
      
      setWalletState({
        walletEvent,
        mintEvent,
        tokenEvents: [], // New wallet starts with no tokens
        loading: false,
        error: null,
        isInitialized: true
      });

      return true;
    } catch (error) {
      console.error('[NIP60Wallet] Creation error:', error);
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
      return false;
    }
  };

  /**
   * Refresh wallet data from relays
   */
  const refreshWallet = async () => {
    if (!user) return;
    
    setWalletState(prev => ({ ...prev, loading: true }));
    
    try {
      const [walletData, tokens] = await Promise.all([
        findWalletEvents(ndk, user.pubkey),
        queryTokenEvents(ndk, user.pubkey)
      ]);

      setWalletState(prev => ({
        ...prev,
        walletEvent: walletData?.walletEvent || prev.walletEvent,
        mintEvent: walletData?.mintEvent || prev.mintEvent,
        tokenEvents: tokens,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('[NIP60Wallet] Refresh error:', error);
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  // Computed values
  const balance = useMemo(() => {
    return calculateBalance(walletState.tokenEvents);
  }, [walletState.tokenEvents]);

  const hasWallet = Boolean(walletState.walletEvent);

  const currentMint = useMemo(() => {
    if (!walletState.mintEvent) return null;
    
    try {
      const mintData = JSON.parse(walletState.mintEvent.content);
      const mintUrl = mintData.mints?.[0]?.url;
      return SUPPORTED_MINTS.find(m => m.url === mintUrl) || { 
        name: 'Custom Mint', 
        url: mintUrl 
      };
    } catch (error) {
      return null;
    }
  }, [walletState.mintEvent]);

  return {
    // State
    ...walletState,
    balance,
    hasWallet,
    currentMint,
    
    // Actions
    createWallet,
    refreshWallet,
    discoverWallet
  };
};
```

---

## 🎨 Phase 3: Simplified Components

### Replace `src/pages/EcashWallet.jsx`

```javascript
// src/pages/EcashWallet.jsx
import { useState } from 'react';
import { useNip60Wallet } from '../hooks/useNip60Wallet';
import { SUPPORTED_MINTS } from '../utils/nip60Events';

export const EcashWallet = () => {
  const {
    loading,
    error,
    hasWallet,
    balance,
    currentMint,
    tokenEvents,
    createWallet,
    refreshWallet
  } = useNip60Wallet();

  const [selectedMint, setSelectedMint] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWallet = async () => {
    if (!selectedMint) return;
    
    setIsCreating(true);
    try {
      await createWallet(selectedMint);
    } catch (error) {
      console.error('Failed to create wallet:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading && !hasWallet) {
    return (
      <div className="ecash-wallet-page">
        <div className="loading-state">
          <h2>🔍 Discovering NIP-60 Wallet...</h2>
          <p>Querying relays for existing wallet events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ecash-wallet-page">
        <div className="error-state">
          <h2>❌ Wallet Error</h2>
          <p>{error}</p>
          <button onClick={refreshWallet}>Retry</button>
        </div>
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="ecash-wallet-page">
        <div className="wallet-creation">
          <h2>🆕 Create NIP-60 Wallet</h2>
          <p>No existing wallet found. Create a new ecash wallet by selecting a mint:</p>
          
          <div className="mint-selection">
            {SUPPORTED_MINTS.map(mint => (
              <div 
                key={mint.url}
                className={`mint-option ${selectedMint === mint.url ? 'selected' : ''}`}
                onClick={() => setSelectedMint(mint.url)}
              >
                <h3>{mint.name}</h3>
                <p>{mint.description}</p>
                <small>{mint.url}</small>
              </div>
            ))}
          </div>

          <button 
            onClick={handleCreateWallet}
            disabled={!selectedMint || isCreating}
            className="create-wallet-btn"
          >
            {isCreating ? 'Creating Wallet...' : 'Create Wallet'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ecash-wallet-page">
      <div className="wallet-header">
        <h2>🔒 NIP-60 Ecash Wallet</h2>
        <div className="wallet-info">
          <div className="balance-display">
            <span className="balance-label">Balance:</span>
            <span className="balance-amount">{balance} sats</span>
          </div>
          <div className="mint-info">
            <span className="mint-label">Mint:</span>
            <span className="mint-name">{currentMint?.name || 'Unknown'}</span>
          </div>
        </div>
      </div>

      <div className="wallet-actions">
        <button onClick={refreshWallet} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="transaction-history">
        <h3>Event History</h3>
        <p>Found {tokenEvents.length} token events</p>
        {tokenEvents.length === 0 ? (
          <p className="no-events">No token events found. Wallet is ready to receive tokens.</p>
        ) : (
          <div className="event-list">
            {tokenEvents.slice(0, 10).map(event => (
              <div key={event.id} className="event-item">
                <span className="event-type">{event.content?.type || 'unknown'}</span>
                <span className="event-amount">{event.content?.amount || 0} sats</span>
                <span className="event-date">
                  {new Date(event.created_at * 1000).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="debug-info">
        <details>
          <summary>Debug: Raw Event Data</summary>
          <pre>{JSON.stringify({ 
            hasWallet, 
            balance, 
            eventCount: tokenEvents.length,
            currentMint: currentMint?.url 
          }, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
};
```

---

## 🧹 Phase 4: Cleanup & Integration

### Files to Delete:
1. **`src/contexts/EcashWalletContext.jsx`** - Replace with `useNip60Wallet` hook
2. **`src/components/EcashWalletConnector.jsx`** - Functionality moved to main page
3. **`src/services/ecashWalletService.js`** - Replace with `nip60Events.js`

### Files to Update:

#### `src/pages/Wallet.jsx` - Update description:
```javascript
<div className="wallet-option">
  <h3>🔒 Ecash Wallet (NIP-60)</h3>
  <p>Event-based ecash wallet using NIP-60. Automatically discovers existing wallets or creates new ones. Pure Nostr implementation.</p>
  <button 
    onClick={() => navigate('/ecash')}
    className="wallet-option-button ecash-button"
  >
    Open Ecash Wallet
  </button>
</div>
```

---

## 🎨 Phase 5: CSS Updates

### Add to `src/App.css`:

```css
/* NIP-60 Wallet Styles */
.ecash-wallet-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.wallet-creation {
  text-align: center;
  padding: 40px 20px;
}

.mint-selection {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  margin: 20px 0;
}

.mint-option {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.2s;
}

.mint-option.selected {
  border-color: #4CAF50;
  background-color: #f8fff8;
}

.mint-option:hover {
  border-color: #ccc;
}

.wallet-header {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.wallet-info {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}

.balance-amount {
  font-weight: bold;
  color: #4CAF50;
}

.event-list {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.event-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid #f0f0f0;
}

.event-item:last-child {
  border-bottom: none;
}

.debug-info {
  margin-top: 30px;
  font-size: 12px;
}

.debug-info pre {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
}

.loading-state, .error-state {
  text-align: center;
  padding: 40px 20px;
}

.create-wallet-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
}

.create-wallet-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

---

## 🔄 Implementation Order:

1. **Start with utilities** - Create `nip60Events.js` first
2. **Add the hook** - Create `useNip60Wallet.js` 
3. **Update the page** - Replace `EcashWallet.jsx` content
4. **Test discovery** - Verify wallet discovery works
5. **Test creation** - Verify wallet creation works
6. **Add CSS** - Style the new components
7. **Clean up** - Delete old files and contexts

---

## ✅ Key Benefits of This Implementation:

✅ **Auto-Discovery**: Automatically finds existing NIP-60 wallets
✅ **Auto-Creation**: Creates wallet if none exists  
✅ **Event-Driven**: Pure Nostr event queries, no broken methods
✅ **Transparent**: Shows actual events and balance calculation
✅ **Simple State**: Just events + loading + error
✅ **No Abstractions**: Direct control over Nostr events
✅ **Debuggable**: Clear event data visible in UI

---

## 🚫 What This Eliminates:

❌ Guessing which wallet methods exist  
❌ Complex connection state management
❌ Wallet object abstractions that don't match NIP-60
❌ Balance stored in React state (calculate from events instead)
❌ 500+ lines of complex context code
❌ All the broken `NDKCashuWallet` method calls

This implementation completely eliminates the broken `NDKCashuWallet` method calls and replaces them with reliable Nostr event operations that follow the actual NIP-60 specification. 