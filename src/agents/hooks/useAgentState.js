import { useState, useEffect, useCallback } from 'react';
import { agentManager } from '../AgentManager.js';

/**
 * React hook for subscribing to agent state changes
 * 
 * @param {string} agentName - Name of the agent to watch
 * @param {string|string[]} [stateKeys] - Specific state keys to watch (optional)
 * @returns {object} Current state and update function
 * 
 * @example
 * ```jsx
 * function CurrentActivityDisplay() {
 *   const { state, loading } = useAgentState('Dashboard', 'currentActivity');
 *   
 *   if (loading) return <div>Loading...</div>;
 *   
 *   return (
 *     <div>
 *       {state.currentActivity ? (
 *         <div>Active: {state.currentActivity.mode}</div>
 *       ) : (
 *         <div>No active activity</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAgentState(agentName, stateKeys = null) {
  const [state, setState] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Filter state based on specified keys
   */
  const filterState = useCallback((fullState, keys) => {
    if (!keys) return fullState;
    
    const keysArray = Array.isArray(keys) ? keys : [keys];
    const filtered = {};
    
    for (const key of keysArray) {
      if (key in fullState) {
        filtered[key] = fullState[key];
      }
    }
    
    return filtered;
  }, []);

  /**
   * Load initial state
   */
  const loadInitialState = useCallback(async () => {
    try {
      const agent = agentManager.getAgent(agentName);
      if (!agent) {
        throw new Error(`Agent ${agentName} not found`);
      }

      const agentState = agent.getState();
      const filteredState = filterState(agentState, stateKeys);
      
      setState(filteredState);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error(`Failed to load state for ${agentName}:`, err);
    } finally {
      setLoading(false);
    }
  }, [agentName, stateKeys, filterState]);

  /**
   * Handle state changes
   */
  const handleStateChange = useCallback((newState) => {
    const filteredState = filterState(newState, stateKeys);
    setState(filteredState);
  }, [stateKeys, filterState]);

  /**
   * Set up state subscription
   */
  useEffect(() => {
    let mounted = true;
    
    const setupSubscription = async () => {
      try {
        // Wait for agent system to be ready
        if (!agentManager.initialized) {
          await new Promise(resolve => {
            const checkReady = () => {
              if (agentManager.initialized) {
                resolve();
              } else {
                setTimeout(checkReady, 100);
              }
            };
            checkReady();
          });
        }

        if (!mounted) return;

        // Load initial state
        await loadInitialState();

        // Subscribe to state changes
        const agent = agentManager.getAgent(agentName);
        if (agent) {
          agent.on('stateChanged', handleStateChange);
        }

      } catch (err) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    setupSubscription();

    return () => {
      mounted = false;
      
      // Cleanup subscription
      const agent = agentManager.getAgent(agentName);
      if (agent) {
        agent.off('stateChanged', handleStateChange);
      }
    };
  }, [agentName, loadInitialState, handleStateChange]);

  /**
   * Refresh state manually
   */
  const refresh = useCallback(async () => {
    await loadInitialState();
  }, [loadInitialState]);

  /**
   * Update state (sends message to agent)
   */
  const updateState = useCallback(async (updates) => {
    try {
      const response = await agentManager.sendMessage(
        agentName, 
        'state.update', 
        { updates }
      );
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response;
    } catch (err) {
      console.error(`Failed to update state for ${agentName}:`, err);
      throw err;
    }
  }, [agentName]);

  return {
    state,
    loading,
    error,
    refresh,
    updateState
  };
}