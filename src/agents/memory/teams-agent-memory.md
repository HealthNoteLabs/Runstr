# Teams Agent Memory

**Agent**: TeamsAgent  
**Location**: `src/agents/TeamsAgent.js`  
**Last Updated**: 2025-01-31  
**Version**: 1.0.0

## Mission Statement
Manage all team-related functionality including creation, membership, chat, events, and team-specific workflows in the Runstr application.

## Key Files to Reference

### Core Team Functionality
- `src/pages/Teams.jsx` - Main teams listing and management interface
- `src/pages/TeamDetail.jsx` - Individual team view with chat and member management
- `src/services/NostrTeamsService.js` - Core team operations service
- `src/utils/ndkGroups.js` - NIP-29 group utilities for team operations
- `src/hooks/useNip101TeamsFeed.js` - Team feed data fetching hook
- `src/hooks/useTeamRoles.js` - Team role management hook

### Team Integration Points
- `src/components/ActivityModeBanner.jsx` - Shows current team context
- `src/components/RunTracker.jsx` - Team integration in workout posting
- `src/utils/settingsManager.js` - Default team management utilities
- `src/services/nameResolver.js` - Team name caching and resolution

### Chat & Communication
- `src/components/ChatRoom.jsx` - Team chat interface component
- NIP-29 message kinds: kind 9 (chat), kind 9021 (leave), kind 39000 (metadata)

## Current State & Capabilities

### ✅ Implemented Features
- Team listing and discovery
- Team creation with metadata publishing
- Team joining via NIP-29 group join events
- Team leaving with proper event publishing
- Default posting team selection and persistence
- Team name caching for workout publishing
- Basic team member management
- Team metadata parsing and display

### 🚧 Partially Implemented
- Team chat functionality (UI exists, agent integration pending)
- Team events and challenges
- Member role management
- Team statistics and analytics

### ❌ Not Yet Implemented
- Advanced team permissions
- Team-specific achievements
- Team competition features
- Team activity feeds beyond basic events
- Cross-team interactions

## Success Patterns

### Team Creation ✅
```javascript
// Successful pattern for team creation
const result = await sendMessage('Teams', 'team.create', {
  name: 'Team Name',
  description: 'Team Description',
  isPublic: true,
  rules: ['Be respectful', 'Stay active']
});
```
**Why it works**: Uses proper NIP-29 metadata format with all required tags.

### Team Joining ✅
```javascript
// Successful team joining pattern  
const result = await sendMessage('Teams', 'team.join', {
  teamUUID: 'uuid-from-team-list',
  captainPubkey: 'captain-public-key'
});
```
**Why it works**: Leverages existing `ndkGroups.js` utilities for proper group join events.

### Default Team Setting ✅
```javascript
// Successful default team pattern
const result = await sendMessage('Teams', 'team.setDefault', {
  captainPubkey: 'captain-key',
  teamUUID: 'team-uuid', 
  teamName: 'Display Name'
});
```
**Why it works**: Properly caches team name and persists selection for workout publishing.

## Failure Patterns & Lessons Learned

### ❌ Direct NDK Usage
**Problem**: Initially tried to bypass existing team services and use NDK directly.
**Lesson**: Always use existing services like `NostrTeamsService.js` and `ndkGroups.js` utilities - they handle edge cases and state management properly.
**Solution**: Integrate with existing services through agent messages.

### ❌ Missing Team Context
**Problem**: Team operations failed when user context was missing.
**Lesson**: Always verify authentication state before team operations.
**Solution**: Check `CoreServices` auth state first: `await sendMessage('CoreServices', 'auth.getState', {})`

### ❌ State Synchronization Issues
**Problem**: Team state got out of sync between agent and UI components.
**Lesson**: Team state changes must be broadcast to all interested agents.
**Solution**: Always broadcast `TEAM_JOINED`, `TEAM_LEFT`, `TEAM_UPDATED` events after successful operations.

## Known Issues & Workarounds

### Issue 1: Team Chat Integration
**Problem**: Chat functionality exists in UI but not fully integrated with agent system.
**Status**: Needs completion
**Workaround**: Use existing `ChatRoom.jsx` component patterns
**Fix**: Implement `team.chat.send` and `team.chat.history` message handlers

### Issue 2: Team Member Management
**Problem**: Member addition/removal not fully implemented in agent.
**Status**: Partially working
**Workaround**: Use existing `ndkGroups.js` functions directly
**Fix**: Complete `team.members.add` and `team.members.remove` handlers

### Issue 3: Team Events
**Problem**: Team events beyond basic metadata not implemented.
**Status**: Not started
**Workaround**: Manual event creation through existing UI
**Fix**: Implement `team.events.create` and `team.events.list` handlers

## Best Practices

### Authentication First
Always verify user authentication before any team operations:
```javascript
const authResponse = await this.sendMessage('CoreServices', 'auth.getState', {});
if (!authResponse.success || !authResponse.data.isAuthenticated) {
  throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
}
```

### State Broadcasting
After successful team operations, always broadcast changes:
```javascript
await this.broadcast(MessageTypes.TEAM_JOINED, {
  teamUUID,
  captainPubkey,
  userPubkey
});
```

### Error Handling
Use consistent error patterns with proper error codes:
```javascript
throw new AgentError(
  `Failed to join team: ${error.message}`,
  ErrorCodes.COMMUNICATION_ERROR
);
```

### Team Name Caching
Always cache team names for display purposes:
```javascript
const { cacheTeamName } = await import('../utils/settingsManager.js');
cacheTeamName(teamUUID, captainPubkey, teamName);
```

## Recent Wins 🎉

- **Team Creation**: Successfully implemented team creation with proper NIP-29 metadata
- **Default Team Selection**: Working integration with workout publishing system
- **Team Name Display**: Proper team name display in activity banners and workout posts
- **State Management**: Clean state synchronization between agent and UI components

## Immediate Priorities

1. **Complete Chat Integration** - Finish `team.chat.send` and `team.chat.history` handlers
2. **Member Management** - Complete member add/remove functionality
3. **Team Events** - Implement basic team event creation and listing
4. **Error Recovery** - Improve error handling for network failures

## Integration Notes

### With Dashboard Agent
- Default team selection affects workout publishing
- Team context displayed in activity banners
- Automatic team tagging in workout events

### With Profile Agent  
- Team membership affects user statistics
- Team-based achievements and social features

### With Navigation Agent
- Team detail routes and state management
- Deep linking to specific teams

### With Core Services Agent
- All team operations require Nostr connectivity
- Authentication state is critical for team operations
- Relay management affects team data availability

## Message API

### Primary Messages
- `team.list` - Get available teams
- `team.create` - Create new team
- `team.join` - Join existing team  
- `team.leave` - Leave team
- `team.setDefault` - Set default posting team
- `team.getDefault` - Get current default team

### Chat Messages (In Progress)
- `team.chat.send` - Send team chat message
- `team.chat.history` - Get chat history

### Member Management (Partial)
- `team.members.list` - List team members
- `team.members.add` - Add team member
- `team.members.remove` - Remove team member

Remember: Always consult this memory before working with teams functionality, and update this document after significant successes or failures.