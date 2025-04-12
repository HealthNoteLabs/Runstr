# Nostr Feed Debugging Tools

A collection of terminal-based tools to debug Nostr feed issues without requiring Android Studio.

## Installation

1. Make sure Node.js is installed on your system (v14 or higher)
2. Install dependencies:
   ```
   npm install
   ```

## Available Tools

### 1. Relay Connection Test

Tests basic connectivity to common Nostr relays.

```bash
npm run test-relay
```

This script will:
- Test connectivity to popular Nostr relays
- Report which relays are accessible
- Provide a summary of connection status

### 2. Hashtag Testing

Tests availability of running-related hashtags on Nostr relays.

```bash
npm run test-hashtag
```

This script will:
- Connect to multiple Nostr relays
- Test each relay with various running-related hashtags
- Display sample posts when found
- Provide a summary with recommendations

### 3. Interactive Debugging Tool

A comprehensive interactive tool for diagnosing Nostr feed issues.

```bash
npm run debug
```

This tool provides a menu-driven interface with:
- Relay connectivity testing
- Hashtag filtering testing
- Content-based filtering testing
- Non-reply posts testing
- Custom filter testing
- Automatic fix recommendations

## Troubleshooting Nostr Feed Issues

Common issues and fixes:

1. **No relay connections**
   - Check internet connectivity
   - Try different relays
   - Check for firewall blocking WebSocket connections

2. **No hashtag results**
   - Implement content-based filtering as a fallback
   - Expand the time window beyond 30 days
   - Try different hashtags or combinations

3. **Posts not rendering**
   - Check the PostList component
   - Verify if the posts array is populated
   - Check CSS styles for visibility issues

4. **Too many replies**
   - Implement client-side filtering for non-reply posts
   - Make sure your filter isn't excluding all post types

## Solution Patterns

Based on testing, the most likely solutions are:

1. **Add content-based filtering fallback:**
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

2. **Add visual debugging elements to the UI**
   ```jsx
   <div className="debug-overlay" style={{position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.8)', color: 'white', padding: '10px', zIndex: 1000}}>
     <h3>Debug Info</h3>
     <p>Connected relays: {ndk.pool?.relays?.size || 0}</p>
     <p>Posts loaded: {posts.length}</p>
     <p>Feed error: {error || 'None'}</p>
     <button onClick={fetchRunPostsViaSubscription}>Refresh Feed</button>
   </div>
   ```

## Further Reading

- [Nostr Protocol Documentation](https://github.com/nostr-protocol/nips)
- [NDK Documentation](https://github.com/nostr-dev-kit/ndk)
- [WebSocket Debugging](https://github.com/blakejakopovic/nostcat) 