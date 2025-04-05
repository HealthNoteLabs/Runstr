# Fixing Empty Feed Issues in Runstr

Based on the diagnostic test results, running-related posts **ARE** available on Nostr relays. The issue is likely with how your app is fetching or rendering the feed data.

## Recommended Fix #1: Implement Content Fallback

The most reliable solution is to implement a content-based fallback when hashtag queries return empty results:

1. Edit your feed fetching code (likely in `src/utils/nostr.js` or similar file)
2. Implement this enhanced fetching function:

```javascript
export const fetchRunningPosts = async (limit = 10, since = undefined) => {
  try {
    // Try hashtag-based filtering first
    const defaultSince = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const sinceTimestamp = since ? Math.floor(since / 1000) : defaultSince;
    
    console.log("Fetching running posts with hashtags...");
    const hashtagFilter = {
      kinds: [1],
      limit: limit || 10,
      "#t": ["running", "run", "runner", "runstr", "5k", "10k", "marathon", "jog"],
      since: sinceTimestamp
    };
    
    const events = await ndk.fetchEvents(hashtagFilter);
    let eventArray = Array.from(events);
    
    // If hashtag search found results, return them
    if (eventArray.length > 0) {
      console.log(`Found ${eventArray.length} posts with hashtags`);
      return eventArray;
    }
    
    // Fallback to content-based filtering
    console.log("No hashtag results, trying content-based filtering...");
    const contentFilter = {
      kinds: [1],
      limit: (limit || 10) * 3, // Get more to filter client-side
      since: sinceTimestamp
    };
    
    const contentEvents = await ndk.fetchEvents(contentFilter);
    const allEvents = Array.from(contentEvents);
    
    // Filter for running content client-side
    const runningKeywords = ["running", "run", "runner", "5k", "10k", "marathon", "jog"];
    const runningEvents = allEvents.filter(event => {
      const content = event.content.toLowerCase();
      return runningKeywords.some(keyword => content.includes(keyword));
    }).slice(0, limit);
    
    console.log(`Found ${runningEvents.length} posts via content filtering`);
    return runningEvents;
  } catch (error) {
    console.error("Error fetching running posts:", error);
    return [];
  }
};
```

## Recommended Fix #2: Add Debug Overlay (Temporary)

To help diagnose rendering issues, add a temporary debug overlay to your feed component:

```jsx
import React from 'react';

function RunFeed() {
  // Existing component code...
  
  return (
    <div className="run-feed">
      {/* Existing component rendering... */}
      
      {/* Debug overlay - remove after debugging */}
      <div className="debug-overlay" style={{
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        background: 'rgba(0,0,0,0.8)', 
        color: 'white', 
        padding: '10px', 
        zIndex: 1000
      }}>
        <h3>Debug Info</h3>
        <p>Connected relays: {ndk?.pool?.relays?.size || 0}</p>
        <p>Posts loaded: {posts?.length || 0}</p>
        <p>Feed error: {error || 'None'}</p>
        <button onClick={() => fetchRunPosts()}>Refresh Feed</button>
      </div>
    </div>
  );
}
```

## Recommended Fix #3: Check Relay Configuration

The tests showed that most relays have running-related content, but some might be unreliable. Ensure your app prioritizes these working relays:

```javascript
// In your NDK configuration
const relays = [
  "wss://relay.damus.io",  // Most reliable for running content
  "wss://nos.lol",         // Good secondary option
  "wss://relay.nostr.band",// Has unique running content
  "wss://nostr.wine",
  "wss://eden.nostr.land"
]
```

## Additional Checks

1. Make sure your feed component properly renders the posts array
2. Verify that the `map()` function or rendering loop actually shows items
3. Check that your CSS isn't hiding feed items with `display: none`
4. Consider adding a loading state to show when fetching is in progress
5. Add a message when no posts are found rather than showing nothing

## Contact

If you continue having issues after implementing these fixes, run the debug tools again and share the results for further assistance. 