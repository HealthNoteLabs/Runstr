/**
 * Runstr Agent System
 * 
 * A modular, message-driven architecture for managing different aspects
 * of the Runstr application.
 * 
 * @example
 * ```javascript
 * import { agentManager } from './agents';
 * 
 * // Initialize the system
 * await agentManager.initialize();
 * 
 * // Send messages to agents
 * const response = await agentManager.sendMessage('Teams', 'team.list', {});
 * ```
 */

// Core infrastructure
export { BaseAgent } from './core/BaseAgent.js';
export { MessageBus } from './core/MessageBus.js';
export { 
  AgentMessage, 
  AgentResponse, 
  MessageTypes, 
  AgentCapabilities,
  AgentError,
  ErrorCodes 
} from './core/AgentInterface.js';

// Individual agents
export { CoreServicesAgent } from './CoreServicesAgent.js';
export { TeamsAgent } from './TeamsAgent.js';
export { DashboardAgent } from './DashboardAgent.js';
export { ProfileAgent } from './ProfileAgent.js';
export { LeagueAgent } from './LeagueAgent.js';
export { MusicAgent } from './MusicAgent.js';
export { SettingsAgent } from './SettingsAgent.js';
export { NavigationAgent } from './NavigationAgent.js';

// Agent manager (singleton)
export { AgentManager, agentManager } from './AgentManager.js';

// Convenience hooks for React integration
export { useAgent } from './hooks/useAgent.js';
export { useAgentState } from './hooks/useAgentState.js';
export { useAgentMessage } from './hooks/useAgentMessage.js';