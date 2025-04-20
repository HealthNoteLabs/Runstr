# RUNSTR Component Refactoring Plan

This document outlines the specific changes needed for each component to support the mobile-only architecture.

## Core Components

### RunTracker.jsx

**Current Status**: Mostly mobile-optimized with some web dependencies.

**Required Changes**:
- Replace localStorage usage with Capacitor Preferences
- Replace browser alert/confirm with native dialogs
- Optimize image handling for mobile devices
- Add haptic feedback for tracking controls

**Example Code Changes**:

```javascript
// Before (Web)
localStorage.setItem('activeRunState', JSON.stringify(runData));

// After (Mobile)
import { setItem } from '../utils/storage';
await setItem('activeRunState', runData);
```

### NostrPublisher.jsx

**Current Status**: Uses web-specific methods for authentication and publishing.

**Required Changes**:
- Remove NIP-07 browser extension support
- Replace with native key management
- Add offline queue support
- Optimize image upload for mobile

**Example Code Changes**:

```javascript
// Before (Web + Mobile hybrid)
if (window.nostr) {
  try {
    const pk = await window.nostr.getPublicKey();
    if (pk) {
      setPubkey(pk);
      setAuthMethod('extension');
      return;
    }
  } catch (error) {
    console.error('Error getting pubkey from extension:', error);
  }
}

// After (Mobile-only)
try {
  // Use only Android-specific method
  if (window.Android && window.Android.getNostrPublicKey) {
    const pk = window.Android.getNostrPublicKey();
    if (pk) {
      setPubkey(pk);
      setAuthMethod('android');
      return;
    }
  }
  
  // Fallback to secure storage
  const pk = await getStoredPublicKey();
  if (pk) {
    setPubkey(pk);
    setAuthMethod('storage');
    return;
  }
} catch (error) {
  console.error('Error getting stored keys:', error);
}
```

### Post.jsx

**Current Status**: Mix of mobile and desktop styles with hover states.

**Required Changes**:
- Remove all hover states and desktop styles
- Replace modal dialogs with bottom sheets
- Optimize image loading for mobile devices
- Add pull-to-refresh support
- Implement swipe gestures for common actions

**Example Code Changes**:

```javascript
// Before (Web modal)
<div className="modal-overlay">
  <div className="modal-content">
    {/* Modal content */}
  </div>
</div>

// After (Mobile bottom sheet)
<BottomSheet isOpen={isOpen} onClose={handleClose}>
  {/* Sheet content */}
</BottomSheet>
```

### MenuBar.jsx

**Current Status**: Dual desktop/mobile navigation.

**Required Changes**:
- Remove desktop navigation completely
- Implement fixed bottom navigation bar
- Add active state indicators
- Optimize touch targets for navigation

**Example Code Changes**:

```javascript
// Before (Responsive)
<div className={`menu-bar ${isDesktop ? 'desktop' : 'mobile'}`}>
  {isDesktop ? (
    <div className="desktop-menu">/* ... */</div>
  ) : (
    <div className="mobile-menu">/* ... */</div>
  )}
</div>

// After (Mobile-only)
<div className="mobile-navigation">
  <div className="tab-bar">
    {tabs.map(tab => (
      <TabButton
        key={tab.id}
        icon={tab.icon}
        label={tab.label}
        isActive={activeTab === tab.id}
        onPress={() => setActiveTab(tab.id)}
      />
    ))}
  </div>
</div>
```

## Page Components

### TeamDetail.jsx

**Current Status**: Uses desktop grid layout for large screens.

**Required Changes**:
- Remove responsive grid layouts
- Replace with mobile-specific layouts
- Simplify UX for mobile interactions
- Optimize list rendering for performance

**Example Code Changes**:

```javascript
// Before (Responsive grid)
<div className="team-detail-container">
  <div className="team-grid">
    <div className="team-info">/* ... */</div>
    <div className="team-members">/* ... */</div>
  </div>
</div>

// After (Mobile stacked layout)
<div className="team-detail-container">
  <div className="team-header">/* ... */</div>
  <Tabs>
    <Tab title="Info">/* Team info */</Tab>
    <Tab title="Members">/* Team members */</Tab>
    <Tab title="Activity">/* Team activity */</Tab>
  </Tabs>
</div>
```

### RunHistory.jsx

**Current Status**: Desktop grid layout with responsive design.

**Required Changes**:
- Remove grid view completely
- Optimize list view for mobile
- Add pull-to-refresh functionality
- Implement infinite scrolling
- Add mobile-specific filters

**Example Code Changes**:

```javascript
// Before (Grid option)
<div className={`run-history-container ${viewMode}`}>
  {viewMode === 'grid' ? (
    <div className="run-grid">/* Grid view */</div>
  ) : (
    <div className="run-list">/* List view */</div>
  )}
</div>

// After (Mobile list only)
<div className="run-history-container">
  <PullToRefresh onRefresh={handleRefresh}>
    <div className="run-list">
      {visibleRuns.map(run => (
        <RunHistoryCard key={run.id} run={run} />
      ))}
      {hasMore && <LoadingIndicator />}
    </div>
  </PullToRefresh>
</div>
```

## Core Services and Contexts

### NostrContext.jsx

**Current Status**: Supports both browser extension and Android integration.

**Required Changes**:
- Remove browser extension support
- Add connection resilience logic
- Implement offline queue
- Add adaptive relay selection
- Optimize for battery efficiency

**Example Code Changes**:

```javascript
// Before (Web + Mobile authentication)
// Try NIP-07 extension
if (window.nostr) {
  try {
    const pk = await window.nostr.getPublicKey();
    if (pk) {
      setPubkey(pk);
      setAuthMethod('extension');
      return;
    }
  } catch (error) {
    console.error('Error getting pubkey from extension:', error);
  }
}

// After (Mobile-only with resilience)
// Add network state monitoring
useEffect(() => {
  const handleNetworkChange = ({ connected }) => {
    setNetworkConnected(connected);
    if (connected && offlineEvents.length > 0) {
      processPendingEvents();
    }
  };
  
  // Use Capacitor Network API
  Network.addListener('networkStatusChange', handleNetworkChange);
  return () => {
    Network.removeAllListeners();
  };
}, [offlineEvents]);
```

### RunTrackerContext.jsx

**Current Status**: Uses localStorage for run state persistence.

**Required Changes**:
- Replace localStorage with Capacitor Preferences
- Add app state handling for background/foreground
- Implement adaptive tracking frequency for battery optimization
- Add fallback for location permission changes

**Example Code Changes**:

```javascript
// Before (localStorage)
const savedRunState = localStorage.getItem('activeRunState');

// After (Capacitor Preferences)
import { getItem } from '../utils/storage';

const getSavedRunState = async () => {
  try {
    const stateJson = await getItem('activeRunState');
    if (stateJson) {
      const runData = JSON.parse(stateJson);
      // Process run data
    }
  } catch (error) {
    console.error('Error restoring run state:', error);
  }
};

// Add app state handling
useEffect(() => {
  const handleAppStateChange = (state) => {
    if (state.isActive) {
      // App came to foreground
      if (trackingState.isTracking && !trackingState.isPaused) {
        runTracker.resumeBackgroundTracking();
      }
    } else {
      // App went to background
      if (trackingState.isTracking) {
        runTracker.optimizeBackgroundTracking();
      }
    }
  };
  
  App.addListener('appStateChange', handleAppStateChange);
  return () => {
    App.removeAllListeners();
  };
}, [trackingState]);
```

## Utility Functions

### Storage Utilities

**Current Status**: Direct localStorage usage throughout codebase.

**New Implementation**:

```javascript
// src/utils/storage.js
import { Preferences } from '@capacitor/preferences';

export const setItem = async (key, value) => {
  await Preferences.set({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value)
  });
};

export const getItem = async (key) => {
  const { value } = await Preferences.get({ key });
  return value;
};

export const removeItem = async (key) => {
  await Preferences.remove({ key });
};

export const clear = async () => {
  await Preferences.clear();
};
```

### Platform Detection

**Current Status**: Mix of responsive design with some mobile detection.

**New Implementation**:

```javascript
// src/utils/platform.js
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform();
export const isAndroid = getPlatform() === 'android';

export const getDeviceInfo = async () => {
  if (isNativePlatform) {
    const { Device } = await import('@capacitor/device');
    return Device.getInfo();
  }
  return null;
};

export const vibrate = async (pattern = 'medium') => {
  if (isNativePlatform) {
    const { Haptics } = await import('@capacitor/haptics');
    switch (pattern) {
      case 'light':
        await Haptics.impact({ style: 'light' });
        break;
      case 'medium':
        await Haptics.impact({ style: 'medium' });
        break;
      case 'heavy':
        await Haptics.impact({ style: 'heavy' });
        break;
      case 'success':
        await Haptics.notification({ type: 'success' });
        break;
      case 'error':
        await Haptics.notification({ type: 'error' });
        break;
      default:
        await Haptics.impact({ style: 'medium' });
    }
  }
};
```

## New Mobile-Specific Components

### BottomSheet Component

```javascript
// src/components/ui/BottomSheet.jsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import './BottomSheet.css';

export const BottomSheet = ({ isOpen, onClose, children, height = '50%' }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      // Lock body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Small delay to allow close animation
      const timer = setTimeout(() => {
        setIsAnimating(false);
        // Restore body scroll
        document.body.style.overflow = '';
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);
  
  // Don't render if not open and not animating
  if (!isOpen && !isAnimating) {
    return null;
  }
  
  return createPortal(
    <div 
      className={`bottom-sheet-container ${isOpen ? 'open' : 'closed'}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bottom-sheet"
        style={{ height }}
      >
        <div className="bottom-sheet-handle"></div>
        <div className="bottom-sheet-content">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

BottomSheet.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  height: PropTypes.string
};
```

### PullToRefresh Component

```javascript
// src/components/ui/PullToRefresh.jsx
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import './PullToRefresh.css';

export const PullToRefresh = ({ onRefresh, children, threshold = 80 }) => {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  
  const handleTouchStart = (e) => {
    // Only enable pull to refresh at the top of the container
    if (containerRef.current.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };
  
  const handleTouchMove = (e) => {
    if (!isPulling) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - startYRef.current;
    
    if (distance > 0) {
      // Prevent default to disable native scroll
      e.preventDefault();
      // Apply resistance to make pull feel natural
      const newDistance = Math.min(distance * 0.5, threshold * 1.5);
      setPullDistance(newDistance);
    } else {
      setPullDistance(0);
    }
  };
  
  const handleTouchEnd = () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      // Call refresh callback
      Promise.resolve(onRefresh())
        .finally(() => {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 500);
        });
    } else {
      setPullDistance(0);
    }
  };
  
  return (
    <div 
      className="pull-to-refresh-container"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="pull-indicator"
        style={{ 
          transform: `translateY(${pullDistance - 50}px)`,
          opacity: pullDistance / threshold
        }}
      >
        {isRefreshing ? 'Refreshing...' : 'Pull to refresh'}
      </div>
      <div 
        className="pull-content"
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
};

PullToRefresh.propTypes = {
  onRefresh: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  threshold: PropTypes.number
};
```

## Migration Timeline

### Week 1: Core Infrastructure
- Create storage utilities
- Set up platform detection
- Add app lifecycle management

### Week 2: Base UI Components
- Implement BottomSheet component
- Create PullToRefresh component
- Develop TabBar component

### Week 3: Service Refactoring
- Refactor storage service
- Update network services
- Optimize location tracking

### Week 4: Component Migration
- Update RunTracker component
- Refactor NostrPublisher
- Mobile-optimize Post component

### Week 5: Screen Refactoring
- Refactor RunHistory screen
- Update TeamDetail screen
- Optimize feed screens

### Week 6: Testing & Optimization
- Battery consumption testing
- Performance optimization
- User testing 