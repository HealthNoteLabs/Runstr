import { useCallback, useRef } from 'react';
import { agentManager } from '../AgentManager.js';

/**
 * React hook for interacting with agents
 * 
 * @param {string} agentName - Name of the agent to interact with
 * @returns {object} Agent interaction methods
 * 
 * @example
 * ```jsx
 * function TeamsComponent() {
 *   const { sendMessage, broadcast, getState } = useAgent('Teams');
 *   
 *   const loadTeams = useCallback(async () => {
 *     const response = await sendMessage('team.list', { limit: 10 });
 *     if (response.success) {
 *       setTeams(response.data.teams);
 *     }
 *   }, [sendMessage]);
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useAgent(agentName) {
  const agentNameRef = useRef(agentName);
  agentNameRef.current = agentName;

  /**
   * Send a message to the agent
   */
  const sendMessage = useCallback(async (messageType, payload = {}) => {
    try {
      return await agentManager.sendMessage(
        agentNameRef.current, 
        messageType, 
        payload
      );
    } catch (error) {
      console.error(`Failed to send message to ${agentNameRef.current}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }, []);

  /**
   * Broadcast a message to all agents
   */
  const broadcast = useCallback(async (messageType, payload = {}) => {
    try {
      return await agentManager.broadcast(messageType, payload);
    } catch (error) {
      console.error('Failed to broadcast message:', error);
      return [];
    }
  }, []);

  /**
   * Get the current state of the agent
   */
  const getState = useCallback(() => {
    const agent = agentManager.getAgent(agentNameRef.current);
    return agent ? agent.getState() : null;
  }, []);

  /**
   * Check if the agent is available and initialized
   */
  const isAvailable = useCallback(() => {
    const agent = agentManager.getAgent(agentNameRef.current);
    return agent && agent.initialized;
  }, []);

  /**
   * Get agent information
   */
  const getInfo = useCallback(() => {
    const agent = agentManager.getAgent(agentNameRef.current);
    if (!agent) return null;

    return {
      name: agent.name,
      version: agent.version,
      dependencies: agent.dependencies,
      initialized: agent.initialized
    };
  }, []);

  return {
    sendMessage,
    broadcast,
    getState,
    isAvailable,
    getInfo
  };
}