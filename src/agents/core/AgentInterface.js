/**
 * Common interfaces and types for agent communication
 */

/**
 * Standard message format for inter-agent communication
 */
export class AgentMessage {
  constructor({ from, to, type, payload, correlationId }) {
    this.from = from;
    this.to = to;
    this.type = type;
    this.payload = payload;
    this.correlationId = correlationId || crypto.randomUUID();
    this.timestamp = Date.now();
  }
}

/**
 * Standard response format
 */
export class AgentResponse {
  constructor({ success, data, error, correlationId }) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.correlationId = correlationId;
    this.timestamp = Date.now();
  }
}

/**
 * Common message types used across agents
 */
export const MessageTypes = {
  // System messages
  AGENT_READY: 'agent:ready',
  AGENT_ERROR: 'agent:error',
  AGENT_STATE_CHANGED: 'agent:stateChanged',
  
  // Navigation messages
  NAVIGATE_TO: 'navigation:navigateTo',
  TAB_CHANGED: 'navigation:tabChanged',
  
  // Data request/response
  DATA_REQUEST: 'data:request',
  DATA_RESPONSE: 'data:response',
  DATA_UPDATE: 'data:update',
  
  // User actions
  USER_ACTION: 'user:action',
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  
  // Team specific
  TEAM_JOINED: 'team:joined',
  TEAM_LEFT: 'team:left',
  TEAM_UPDATED: 'team:updated',
  TEAM_EVENT_CREATED: 'team:eventCreated',
  
  // Activity specific
  ACTIVITY_STARTED: 'activity:started',
  ACTIVITY_COMPLETED: 'activity:completed',
  ACTIVITY_PAUSED: 'activity:paused',
  
  // Profile specific
  PROFILE_UPDATED: 'profile:updated',
  STATS_UPDATED: 'stats:updated',
  
  // Music specific
  MUSIC_PLAY: 'music:play',
  MUSIC_PAUSE: 'music:pause',
  MUSIC_TRACK_CHANGED: 'music:trackChanged',
  
  // Settings specific
  SETTINGS_CHANGED: 'settings:changed',
  PREFERENCE_UPDATED: 'preference:updated',
  
  // Wallet specific
  WALLET_CONNECTED: 'wallet:connected',
  WALLET_DISCONNECTED: 'wallet:disconnected',
  PAYMENT_SENT: 'payment:sent',
  PAYMENT_RECEIVED: 'payment:received'
};

/**
 * Agent capability definitions
 */
export const AgentCapabilities = {
  TEAMS: ['team.create', 'team.join', 'team.leave', 'team.manage', 'team.chat'],
  DASHBOARD: ['activity.track', 'activity.view', 'feed.view', 'feed.post'],
  PROFILE: ['profile.view', 'profile.edit', 'stats.view', 'achievements.view'],
  LEAGUE: ['league.view', 'league.join', 'leaderboard.view'],
  MUSIC: ['music.play', 'music.search', 'playlist.manage'],
  SETTINGS: ['settings.view', 'settings.edit', 'preferences.manage'],
  NAVIGATION: ['navigation.control', 'state.sync', 'route.manage'],
  CORE_SERVICES: ['nostr.connect', 'auth.manage', 'relay.manage', 'data.fetch']
};

/**
 * Standard error types
 */
export class AgentError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
  }
}

export const ErrorCodes = {
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  INITIALIZATION_ERROR: 'INITIALIZATION_ERROR',
  COMMUNICATION_ERROR: 'COMMUNICATION_ERROR',
  STATE_ERROR: 'STATE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};