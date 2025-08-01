# Runstr Agent System

A modular, message-driven architecture for managing different aspects of the Runstr application. Each agent is responsible for a specific domain and communicates with others through a central message bus.

## Architecture Overview

The agent system follows these key principles:

- **Separation of Concerns**: Each agent handles a specific domain (teams, dashboard, music, etc.)
- **Message-Driven Communication**: Agents communicate through a central message bus using standardized message formats
- **Dependency Management**: Agents declare dependencies and initialize in the correct order
- **State Management**: Each agent manages its own state and can share it with others
- **Error Isolation**: Failures in one agent don't crash the entire system

## Core Components

### Message Bus (`core/MessageBus.js`)
Central communication hub that routes messages between agents. Supports:
- Point-to-point messaging
- Broadcast messaging  
- Message history and monitoring
- Subscription-based event handling

### Base Agent (`core/BaseAgent.js`)
Abstract base class that all agents extend. Provides:
- Message handling infrastructure
- State management
- Lifecycle hooks (initialize, destroy)
- Dependency declaration

### Agent Interfaces (`core/AgentInterface.js`)
Standardized message types, response formats, and error codes used across the system.

## Available Agents

### 1. Core Services Agent (`CoreServicesAgent.js`)
**Dependencies**: None  
**Responsibilities**:
- Nostr connection management
- Authentication and user session handling
- Relay management
- Data fetching and publishing
- Common utilities shared across agents

**Key Messages**:
- `nostr.connect` - Establish Nostr connection
- `nostr.publish` - Publish events to Nostr
- `nostr.fetch` - Fetch events from relays
- `auth.getState` - Get authentication status

### 2. Settings Agent (`SettingsAgent.js`)
**Dependencies**: CoreServices  
**Responsibilities**:
- Application configuration management
- User preferences storage
- Settings validation and persistence
- Theme and UI preferences

**Key Messages**:
- `settings.get` - Get specific setting
- `settings.set` - Update setting value
- `settings.getAll` - Get all settings
- `theme.set` - Change application theme

### 3. Navigation Agent (`NavigationAgent.js`)
**Dependencies**: None  
**Responsibilities**:
- Route management and navigation
- Cross-tab state coordination
- Browser history management
- Deep linking support

**Key Messages**:
- `navigation.navigateTo` - Navigate to route
- `navigation.getCurrentRoute` - Get current route
- `state.sync` - Synchronize state across tabs
- `tab.setState` - Set tab-specific state

### 4. Dashboard Agent (`DashboardAgent.js`)
**Dependencies**: CoreServices  
**Responsibilities**:
- Activity tracking (GPS, distance, time)
- Run data management
- Feed operations
- Workout publishing
- Activity statistics

**Key Messages**:
- `activity.start` - Start activity tracking
- `activity.stop` - Stop and save activity
- `workout.publish` - Publish workout to Nostr
- `feed.get` - Get activity feed

### 5. Profile Agent (`ProfileAgent.js`)
**Dependencies**: CoreServices  
**Responsibilities**:
- User profile management
- Statistics calculation and caching
- Achievement system
- Social features (follow/unfollow)
- Leaderboard positioning

**Key Messages**:
- `profile.get` - Get user profile
- `profile.update` - Update profile data
- `achievements.check` - Check for new achievements
- `social.follow` - Follow another user

### 6. Teams Agent (`TeamsAgent.js`)
**Dependencies**: CoreServices  
**Responsibilities**:
- Team management (create, join, leave)
- Team chat functionality
- Team events and challenges
- Member management
- Default posting team selection

**Key Messages**:
- `team.create` - Create new team
- `team.join` - Join existing team
- `team.chat.send` - Send team chat message
- `team.setDefault` - Set default posting team

### 7. League Agent (`LeagueAgent.js`)
**Dependencies**: CoreServices, Profile  
**Responsibilities**:
- League/club membership
- Leaderboard calculations
- Competition management
- Ranking systems
- Club activity feeds

**Key Messages**:
- `league.join` - Join league
- `leaderboard.get` - Get leaderboard data
- `competition.list` - List active competitions
- `ranking.update` - Update user rankings

### 8. Music Agent (`MusicAgent.js`)
**Dependencies**: CoreServices, Settings  
**Responsibilities**:
- Wavlake music integration
- Audio playback control
- Playlist management
- Music search and discovery
- Blossom server communication

**Key Messages**:
- `music.play` - Play track
- `music.search` - Search for music
- `playlist.add` - Add track to playlist
- `music.getCurrentState` - Get playback state

## Usage Examples

### Basic Agent Communication

```javascript
import { agentManager } from './agents/AgentManager.js';

// Initialize the agent system
await agentManager.initialize();

// Send message to specific agent
const response = await agentManager.sendMessage('Teams', 'team.list', {
  limit: 10
});

if (response.success) {
  console.log('Teams:', response.data.teams);
}

// Broadcast message to all agents
await agentManager.broadcast('user.login', {
  publicKey: 'user-pubkey-here'
});
```

### React Integration

```jsx
import React, { useEffect, useState } from 'react';
import { agentManager } from '../agents/AgentManager.js';

function TeamsList() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const response = await agentManager.sendMessage('Teams', 'team.list', {
          limit: 20
        });
        
        if (response.success) {
          setTeams(response.data.teams);
        }
      } catch (error) {
        console.error('Failed to load teams:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, []);

  if (loading) return <div>Loading teams...</div>;

  return (
    <div>
      {teams.map(team => (
        <div key={team.id}>
          <h3>{team.name}</h3>
          <p>{team.description}</p>
        </div>
      ))}
    </div>
  );
}
```

### Activity Tracking

```javascript
// Start tracking a run
const startResponse = await agentManager.sendMessage('Dashboard', 'activity.start', {
  mode: 'run'
});

// Stop and save the activity
const stopResponse = await agentManager.sendMessage('Dashboard', 'activity.stop', {});

// Publish to Nostr with team association
if (stopResponse.success) {
  await agentManager.sendMessage('Dashboard', 'workout.publish', {
    activity: stopResponse.data.activity,
    includeTeam: true
  });
}
```

### Team Management

```javascript
// Join a team
const joinResponse = await agentManager.sendMessage('Teams', 'team.join', {
  teamUUID: 'team-uuid-here',
  captainPubkey: 'captain-pubkey-here'
});

// Set as default posting team
if (joinResponse.success) {
  await agentManager.sendMessage('Teams', 'team.setDefault', {
    captainPubkey: 'captain-pubkey-here',
    teamUUID: 'team-uuid-here',
    teamName: 'My Team'
  });
}

// Send team chat message
await agentManager.sendMessage('Teams', 'team.chat.send', {
  teamUUID: 'team-uuid-here',
  captainPubkey: 'captain-pubkey-here',
  message: 'Hello team!'
});
```

## Message Flow Examples

### User Login Flow
1. User authenticates → `CoreServices` handles Nostr connection
2. `CoreServices` broadcasts `USER_LOGIN` event
3. `Profile` agent loads user data and stats
4. `Teams` agent loads user's team memberships
5. `Settings` agent loads user preferences
6. `Dashboard` agent loads activity history

### Activity Completion Flow
1. User completes run → `Dashboard` agent saves activity
2. `Dashboard` broadcasts `ACTIVITY_COMPLETED` event
3. `Profile` agent updates user statistics
4. `Profile` agent checks for new achievements
5. `Teams` agent updates team statistics (if applicable)
6. Auto-publish to Nostr if enabled in settings

### Team Join Flow
1. User joins team → `Teams` agent publishes join event
2. `Teams` broadcasts `TEAM_JOINED` event
3. `Profile` agent updates social connections
4. `League` agent updates league membership (if applicable)
5. `Navigation` agent updates route state

## Error Handling

The system includes comprehensive error handling:

- **Agent-level errors**: Each agent catches and handles its own errors
- **Message delivery errors**: Failed messages are logged and can be retried
- **System-level errors**: Global error handlers prevent system crashes
- **Health monitoring**: Periodic checks ensure agents remain responsive

## Monitoring and Debugging

### System Status

```javascript
// Get overall system status
const status = agentManager.getSystemStatus();
console.log('System Status:', status);

// Get message bus statistics
const stats = agentManager.getMessageBusStats();
console.log('Message Bus Stats:', stats);
```

### Debug Mode

```javascript
// Enable detailed logging
agentManager.enableDebugMode();

// Disable debug logging
agentManager.disableDebugMode();
```

### Health Checks

The system automatically performs health checks every 30 seconds, but you can also manually trigger them:

```javascript
// Manual health check
await agentManager.performHealthCheck();
```

## Best Practices

### 1. Message Design
- Use descriptive message types (e.g., `team.join` instead of `join`)
- Include all necessary data in the payload
- Use correlation IDs for tracking request/response pairs
- Validate message payloads before processing

### 2. Error Handling
- Always return `AgentResponse` objects with success/error status
- Use appropriate error codes from `ErrorCodes`
- Log errors with sufficient context
- Implement graceful degradation when dependencies fail

### 3. State Management
- Keep agent state minimal and focused
- Use immutable state updates where possible
- Broadcast state changes that other agents need to know about
- Persist critical state to localStorage or Nostr

### 4. Performance
- Batch related operations when possible
- Use caching for expensive operations
- Limit message history size to prevent memory leaks
- Implement lazy loading for non-critical data

### 5. Testing
- Test agents in isolation using mock message buses
- Test message flows end-to-end
- Test error conditions and recovery scenarios
- Test dependency injection and initialization order

## Adding New Agents

To add a new agent to the system:

1. **Create the agent class** extending `BaseAgent`
2. **Define message handlers** for the agent's responsibilities
3. **Add to AgentManager** in the appropriate initialization order
4. **Update dependencies** if other agents need to communicate with it
5. **Add message types** to `AgentInterface.js` if needed
6. **Document** the agent's API and usage patterns

## Migration Guide

If migrating from the existing context-based architecture:

1. **Identify domains**: Group related functionality into agent boundaries
2. **Extract state**: Move state from React contexts to agents
3. **Convert API calls**: Replace direct function calls with agent messages
4. **Update components**: Use `agentManager.sendMessage()` instead of context methods
5. **Test thoroughly**: Ensure all workflows still function correctly

The agent system is designed to coexist with the existing architecture, allowing for gradual migration.