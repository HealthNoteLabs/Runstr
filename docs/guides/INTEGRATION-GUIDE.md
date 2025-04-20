# RUNSTR Application Refactoring Guide

This guide provides an overview of the recent refactoring and improvements made to the RUNSTR application. The primary goal was to replace the NDK (Nostr Development Kit) with the more lightweight and versatile nostr-tools library, while improving code organization and component structure.

## Component Structure

The refactoring has introduced the following new components, each with a single responsibility:

### 1. ImageManager
**File:** `src/components/ImageManager.jsx`
**Purpose:** Manages image selection, preview, and removal for posts and comments.
**Features:**
- Image selection from device
- Image preview display
- Image removal
- Configurable maximum image count

### 2. NostrPublisher
**File:** `src/components/NostrPublisher.jsx`
**Purpose:** Publishes run data and content to the Nostr network.
**Features:**
- Formats run data into human-readable content
- Supports image attachments
- Shows publishing progress
- Handles error states

### 3. WorkoutRecorder
**File:** `src/components/WorkoutRecorder.jsx`
**Purpose:** Records run data as a standardized workout event on Nostr.
**Features:**
- Creates workout events with standardized tags
- Handles saving state to prevent duplicate records
- Shows success/error feedback

### 4. RunSummary
**File:** `src/components/RunSummary.jsx`
**Purpose:** Displays a summary of run data in a consistent format.
**Features:**
- Shows key run metrics (distance, duration, pace)
- Displays elevation data when available
- Shows split information when available
- Formats date in a user-friendly relative format

## Utility Functions

New utility modules have been created to handle specific functionality:

### 1. Nostr Utilities
**File:** `src/utils/nostr.js`
**Purpose:** Core Nostr functionality using nostr-tools.
**Features:**
- Event creation and publication
- Event fetching and subscription
- Connection management

### 2. File Utilities
**File:** `src/utils/fileUtils.js`
**Purpose:** File handling functions.
**Features:**
- File to base64 conversion (for images)
- Image data extraction
- Image compression

### 3. Workout Utilities
**File:** `src/utils/workoutUtils.js`
**Purpose:** Standardized workout event creation and formatting.
**Features:**
- Workout event creation with standardized tags
- Workout content formatting
- Duration and pace formatting helpers

### 4. Nostr Pool Singleton
**File:** `src/utils/nostrPool.js`
**Purpose:** Manages a singleton pool instance for all Nostr connections.
**Features:**
- Shared connection pool
- Connection tracking
- Subscription management

## Configuration

### Relay Configuration
**File:** `src/config/relays.js`
**Purpose:** Centralized relay management.
**Features:**
- Default relay list
- Environment-specific relay sets
- Special relay sets for different use cases (groups, running focus)

## Context and Hooks

The refactoring introduces new context and hooks for easier integration:

### 1. NostrContext
**File:** `src/contexts/NostrContext.jsx`
**Purpose:** Provides Nostr functionality throughout the app.
**Features:**
- Authentication status
- Connection management
- Shared relay configuration

### 2. useNostrRunFeed
**File:** `src/hooks/useNostrRunFeed.js`
**Purpose:** Fetches and subscribes to running-related content.
**Features:**
- Fetches posts filtered by tags
- Real-time update subscription
- Refresh capability

### 3. usePostInteractions
**File:** `src/hooks/usePostInteractions.js`
**Purpose:** Handles interactions with Nostr posts.
**Features:**
- Like functionality
- Reply functionality
- Repost (boost) functionality

## Function Name Improvements

Several functions have been renamed for clarity:

1. `loadRecentRun` → `loadMostRecentRun` - More explicitly states that it loads the single most recent run
2. `handleRunCompleted` → `refreshAfterRunCompletion` - Better describes that it refreshes data after a run is completed
3. `handlePostToNostr` → `openNostrPublishModal` - More accurately describes that it opens a modal rather than actually posting
4. `fileToBase64` → `convertImageFileToBase64` - More descriptive about the exact conversion taking place
5. `formatRunDate` → `convertRunDateToRelative` - Clarifies that it's converting dates to relative format (Today, Yesterday, etc.)

## Integration Examples

### Using NostrPublisher for Posting Run Data:

```jsx
import { useState } from 'react';
import { NostrPublisher } from '../components/NostrPublisher';

const RunSharePage = () => {
  const [showPublisher, setShowPublisher] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [recentRun, setRecentRun] = useState(null);
  
  // Example run data
  useEffect(() => {
    // Load most recent run
    const runs = JSON.parse(localStorage.getItem('runHistory') || '[]');
    if (runs.length > 0) {
      setRecentRun(runs[0]);
    }
  }, []);
  
  const handleSuccess = () => {
    alert('Run shared successfully!');
    setShowPublisher(false);
  };
  
  const handleError = (error) => {
    console.error('Error sharing run:', error);
    alert('Failed to share run: ' + error.message);
  };
  
  return (
    <div>
      <button onClick={() => setShowPublisher(true)}>
        Share Your Run
      </button>
      
      {showPublisher && (
        <NostrPublisher
          runData={recentRun}
          images={selectedImages}
          onSuccess={handleSuccess}
          onError={handleError}
          onClose={() => setShowPublisher(false)}
        />
      )}
    </div>
  );
};
```

### Using ImageManager for Image Selection:

```jsx
import { useState } from 'react';
import { ImageManager } from '../components/ImageManager';

const ImageUploadExample = () => {
  const [images, setImages] = useState([]);
  
  const handleImageSelected = (file, url) => {
    setImages(prev => [...prev, { file, url }]);
  };
  
  const handleImageRemoved = (index) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].url);
      newImages.splice(index, 1);
      return newImages;
    });
  };
  
  return (
    <div>
      <h2>Select Images</h2>
      <ImageManager
        images={images}
        onImageSelected={handleImageSelected}
        onImageRemoved={handleImageRemoved}
        maxImages={4}
      />
    </div>
  );
};
```

### Using NostrContext Provider:

In your root component or App.js:

```jsx
import { NostrProvider } from './contexts/NostrContext';

const App = () => {
  return (
    <NostrProvider>
      {/* Your app components here */}
    </NostrProvider>
  );
};
```

Then in any component:

```jsx
import { useNostr } from './contexts/NostrContext';

const NostrStatusComponent = () => {
  const { pubkey, connected, requestAuth, signOut } = useNostr();
  
  return (
    <div>
      <p>Connection status: {connected ? 'Connected' : 'Disconnected'}</p>
      {pubkey ? (
        <>
          <p>Logged in as: {pubkey.substring(0, 10)}...</p>
          <button onClick={signOut}>Sign Out</button>
        </>
      ) : (
        <button onClick={requestAuth}>Connect to Nostr</button>
      )}
    </div>
  );
};
```

## Package.json Changes

The following changes have been made to package.json:

1. Removed `@nostr-dev-kit/ndk` dependency
2. Added `nostr-tools` v2.12.0 dependency

To update your dependencies, run:

```bash
npm install
```

## Migration Steps

To migrate existing code to use the new components and utilities, follow these steps:

1. Replace NDK imports with the new utility imports:
   ```javascript
   // Before
   import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
   
   // After
   import { createAndPublishEvent, fetchEvents, subscribeToEvents } from './utils/nostr';
   ```

2. Replace NDK event creation and publishing:
   ```javascript
   // Before
   const event = new NDKEvent(ndk);
   event.kind = 1;
   event.content = "Hello Nostr!";
   event.tags = [["t", "running"]];
   await event.sign();
   await event.publish();
   
   // After
   const eventTemplate = {
     kind: 1,
     content: "Hello Nostr!",
     tags: [["t", "running"]]
   };
   await createAndPublishEvent(eventTemplate);
   ```

3. Replace fetching events:
   ```javascript
   // Before
   const events = await ndk.fetchEvents({
     kinds: [1],
     authors: ['pubkey1', 'pubkey2']
   });
   
   // After
   const events = await fetchEvents({
     kinds: [1],
     authors: ['pubkey1', 'pubkey2']
   });
   ```

4. Replace subscriptions:
   ```javascript
   // Before
   const subscription = ndk.subscribe({
     kinds: [1],
     "#t": ["running"]
   });
   subscription.on('event', handleEvent);
   subscription.on('eose', handleEose);
   
   // After
   const subscription = subscribeToEvents({
     kinds: [1],
     "#t": ["running"]
   }, handleEvent, handleEose);
   
   // Later, to unsubscribe
   subscription.unsubscribe();
   ```

5. Wrap your app with the NostrProvider:
   ```jsx
   import { NostrProvider } from './contexts/NostrContext';
   
   const App = () => {
     return (
       <NostrProvider>
         {/* Your app components */}
       </NostrProvider>
     );
   };
   ```

6. Use the new hooks for Nostr interaction:
   ```jsx
   import { useNostrRunFeed, usePostInteractions } from './hooks';
   
   const RunFeedComponent = () => {
     const { posts, loading, error, refreshPosts } = useNostrRunFeed(['running']);
     const { likePost, replyToPost } = usePostInteractions();
     
     // Use these in your component...
   };
   ```

## Performance Implications

The migration from NDK to nostr-tools brings several performance benefits:

1. **Reduced Bundle Size**: nostr-tools is significantly smaller than NDK, reducing your application's bundle size.
2. **Improved Connection Management**: The singleton pool pattern ensures connections are shared and properly managed.
3. **Better Memory Usage**: Explicit subscription cleanup prevents memory leaks.
4. **Optimized Event Handling**: More efficient event handling with direct control over subscriptions.

## Next Steps

After implementing these changes, consider:

1. Adding more comprehensive error handling
2. Implementing offline capability with local storage
3. Adding unit tests for the new components and utilities
4. Creating a standardized component library
5. Implementing more advanced Nostr features with NIP support 