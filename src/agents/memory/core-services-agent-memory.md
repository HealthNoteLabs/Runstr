# Core Services Agent Memory

**Agent**: CoreServicesAgent  
**Location**: `src/agents/CoreServicesAgent.js`  
**Last Updated**: 2025-01-31  
**Version**: 1.0.0

## Mission Statement
Provide foundational Nostr connectivity, authentication, relay management, and shared data services for all other agents in the system.

## Key Files to Reference

### Nostr Core Infrastructure  
- `src/lib/ndkSingleton.ts` - Single NDK instance across the entire application  
- `src/contexts/NostrContext.jsx` - Authentication and connection state management
- `src/config/relays.js` - Default relay configuration and management
- `src/utils/relays.js` - Relay utility functions and connection handling

### Authentication & Signing
- NIP-07 browser extension support (nos2x, Alby, etc.)
- Amber Android signer integration
- Private key storage and management
- Read-only mode when no signer available

### Data Services
- Event publishing with proper signing
- Event fetching with filtering
- Profile management and caching  
- Relay connectivity monitoring

## Current State & Capabilities

### ✅ Implemented Features
- NDK singleton initialization and management
- Multi-signer support (NIP-07, Amber, private key)
- Relay connection management and monitoring
- Event publishing with automatic signing
- Event fetching with advanced filtering
- Authentication state management
- Profile fetching and caching
- Graceful read-only mode fallback

### 🚧 Partially Implemented
- Advanced relay management (custom relays, relay scoring)
- Connection failure recovery and retry logic
- Event validation and sanitization
- Performance monitoring and metrics

### ❌ Not Yet Implemented
- Relay health monitoring and automatic switching
- Event caching with TTL management
- Batch publishing for multiple events
- Advanced filtering with complex queries
- Relay-specific optimization

## Success Patterns

### NDK Connection ✅
```javascript
// Successful NDK initialization
const result = await sendMessage('CoreServices', 'nostr.connect', {});
if (result.success) {
  // NDK is ready, relays connected
  console.log(`Connected to ${result.data.relayCount} relays`);
}
```
**Why it works**: Uses existing ndkSingleton pattern that handles all edge cases.

### Event Publishing ✅  
```javascript
// Successful event publishing
const result = await sendMessage('CoreServices', 'nostr.publish', {
  event: {
    kind: 1,
    content: 'Hello Nostr!',
    tags: []
  },
  sign: true // Auto-sign with available signer
});
```
**Why it works**: Leverages NDK's built-in signing and publishing with proper error handling.

### Authenticated Data Fetching ✅
```javascript
// Check auth first, then fetch
const authState = await sendMessage('CoreServices', 'auth.getState', {});
if (authState.data.isAuthenticated) {
  const events = await sendMessage('CoreServices', 'nostr.fetch', {
    filter: { kinds: [1], limit: 20 }
  });
}
```
**Why it works**: Always verify authentication before operations requiring user context.

## Failure Patterns & Lessons Learned

### ❌ Multiple NDK Instances
**Problem**: Initially tried to create separate NDK instances for different agents.
**Lesson**: Must use single NDK instance across entire application to avoid connection conflicts.
**Solution**: Always use `ndkSingleton` import - never create new NDK instances.

### ❌ Publishing Without Signer Check
**Problem**: Attempted to publish events when no signer was available.
**Lesson**: Always check authentication state before publishing operations.
**Solution**: Verify `authState.isAuthenticated` and handle read-only mode gracefully.

### ❌ Relay Connection Race Conditions
**Problem**: Other agents tried to use Nostr before connections were established.
**Lesson**: Relay connections are async - must wait for `ndkReady` state.
**Solution**: Agent initialization waits for NDK ready state before declaring ready.

### ❌ Event Validation Skipped
**Problem**: Invalid events caused publishing failures and relay rejections.
**Lesson**: Event structure and content must be validated before publishing.
**Solution**: Implement proper event validation in publishing pipeline.

## Known Issues & Workarounds

### Issue 1: Relay Connection Stability
**Problem**: Some relays have unstable connections causing intermittent failures.
**Status**: Partially mitigated by NDK retry logic
**Workaround**: Use multiple reliable relays in config
**Fix**: Implement relay health monitoring and automatic failover

### Issue 2: Browser Extension Compatibility
**Problem**: Different NIP-07 extensions have varying API implementations.
**Status**: Most major extensions supported
**Workaround**: Feature detection and graceful fallbacks
**Fix**: Standardize on most common extension APIs

### Issue 3: Mobile Signer Integration
**Problem**: Amber signer on Android requires specific setup and permissions.
**Status**: Working but requires user configuration
**Workaround**: Clear user documentation and fallback to private key
**Fix**: Improve Amber signer auto-detection and setup

### Issue 4: Rate Limiting
**Problem**: Some relays implement rate limiting causing publish failures.
**Status**: NDK handles basic retry logic
**Workaround**: Implement exponential backoff
**Fix**: Add proper rate limiting detection and queue management

## Best Practices

### Authentication Flow
Always check and handle auth state properly:
```javascript
const authResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
if (!authResponse.success || !authResponse.data.isAuthenticated) {
  // Handle read-only mode or request authentication
  return this.handleUnauthenticatedState();
}
```

### Event Publishing
Use consistent event publishing pattern:
```javascript
try {
  const event = new NDKEvent(this.nostrContext, {
    kind: eventKind,
    content: JSON.stringify(content),
    tags: eventTags
  });
  
  await event.sign();
  const result = await event.publish();
  return { success: true, eventId: event.id, relayResults: result };
} catch (error) {
  throw new AgentError(`Publishing failed: ${error.message}`, ErrorCodes.COMMUNICATION_ERROR);
}
```

### Data Fetching
Use proper filtering and error handling:
```javascript
try {
  const events = await this.nostrContext.fetchEvents(filter, { limit });
  return Array.from(events).map(event => this.sanitizeEvent(event));
} catch (error) {
  throw new AgentError(`Fetching failed: ${error.message}`, ErrorCodes.COMMUNICATION_ERROR);
}
```

### Error Handling
Provide detailed error context:
```javascript
catch (error) {
  throw new AgentError(
    `Nostr operation failed: ${error.message}`,
    ErrorCodes.COMMUNICATION_ERROR,
    { 
      operation: 'publish',
      eventKind: event.kind,
      relayCount: this.getConnectedRelays().length
    }
  );
}
```

## Recent Wins 🎉

- **NDK Integration**: Successful integration with existing NDK singleton pattern
- **Multi-Signer Support**: Working support for browser extensions and Amber
- **Authentication State**: Reliable authentication state management across agents
- **Event Publishing**: Robust event publishing with proper error handling
- **Profile Caching**: Efficient profile fetching and caching system

## Immediate Priorities

1. **Relay Health Monitoring**: Implement automatic relay health checks and failover
2. **Event Validation**: Add comprehensive event validation before publishing
3. **Rate Limiting**: Implement proper rate limiting detection and queue management
4. **Connection Recovery**: Improve connection failure recovery mechanisms
5. **Performance Metrics**: Add performance monitoring for Nostr operations

## Integration Notes

### With All Other Agents
- **Authentication Required**: All agents depend on auth state from CoreServices
- **Publishing Pipeline**: All Nostr publishing goes through CoreServices
- **Data Fetching**: All Nostr data retrieval uses CoreServices
- **Connection State**: All agents monitor Nostr connectivity through CoreServices

### Critical Dependencies
- **NDK Singleton**: Must never create multiple NDK instances
- **Relay Configuration**: Changes affect all Nostr operations system-wide
- **Signer State**: Authentication changes affect all agent capabilities
- **Connection State**: Network issues impact entire system functionality

## Message API

### Connection Management
- `nostr.connect` - Initialize/verify Nostr connection
- `relay.connect` - Connect to specific relay
- `relay.disconnect` - Disconnect from relay
- `relay.list` - Get connected relays status

### Authentication
- `auth.getState` - Get current authentication state
- User login/logout handled via message bus events

### Data Operations
- `nostr.publish` - Publish event to Nostr
- `nostr.fetch` - Fetch events with filtering
- `data.request` - Generic data request (profiles, events, etc.)

### Profile Management  
- Profile fetching and caching handled automatically
- Profile updates trigger system-wide notifications

## Error Codes Reference

- `COMMUNICATION_ERROR` - Network or relay connectivity issues
- `UNAUTHORIZED` - Authentication required but not available  
- `INITIALIZATION_ERROR` - NDK or relay setup problems
- `VALIDATION_ERROR` - Invalid event data or parameters

Remember: CoreServices is the foundation - all other agents depend on it working correctly. Always consult this memory before making changes to core Nostr functionality.