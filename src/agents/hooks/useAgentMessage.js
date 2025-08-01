import { useState, useEffect, useCallback, useRef } from 'react';
import { agentManager } from '../AgentManager.js';

/**
 * React hook for sending messages to agents with loading states and error handling
 * 
 * @param {string} agentName - Name of the agent to send messages to
 * @returns {object} Message sending function and state
 * 
 * @example
 * ```jsx
 * function TeamJoinButton({ teamId }) {
 *   const { sendMessage, loading, error, data } = useAgentMessage('Teams');
 *   
 *   const handleJoin = async () => {
 *     const result = await sendMessage('team.join', {
 *       teamUUID: teamId,
 *       captainPubkey: 'captain-key'
 *     });
 *     
 *     if (result.success) {
 *       // Handle success
 *     }
 *   };
 *   
 *   return (
 *     <button onClick={handleJoin} disabled={loading}>
 *       {loading ? 'Joining...' : 'Join Team'}
 *       {error && <div>Error: {error}</div>}
 *     </button>
 *   );
 * }
 * ```
 */
export function useAgentMessage(agentName) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  
  const abortControllerRef = useRef(null);

  /**
   * Send a message to the agent
   */
  const sendMessage = useCallback(async (messageType, payload = {}, options = {}) => {
    const { 
      timeout = 10000,
      retries = 0,
      onSuccess,
      onError 
    } = options;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setData(null);
    setLastMessage({ type: messageType, payload, timestamp: Date.now() });

    let attempt = 0;
    let response = null;

    while (attempt <= retries) {
      try {
        // Check if request was aborted
        if (abortControllerRef.current.signal.aborted) {
          throw new Error('Request aborted');
        }

        // Send message with timeout
        const messagePromise = agentManager.sendMessage(agentName, messageType, payload);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), timeout);
        });

        response = await Promise.race([messagePromise, timeoutPromise]);

        // Check if request was aborted after completion
        if (abortControllerRef.current.signal.aborted) {
          throw new Error('Request aborted');
        }

        if (response.success) {
          setData(response.data);
          setError(null);
          
          if (onSuccess) {
            onSuccess(response.data);
          }
          
          break; // Success, exit retry loop
        } else {
          throw new Error(response.error || 'Unknown error');
        }
        
      } catch (err) {
        attempt++;
        
        if (attempt > retries) {
          // Final attempt failed
          const errorMessage = err.message || 'Unknown error';
          setError(errorMessage);
          setData(null);
          
          if (onError) {
            onError(errorMessage);
          }
          
          response = {
            success: false,
            error: errorMessage
          };
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    setLoading(false);
    return response;
  }, [agentName]);

  /**
   * Send multiple messages in parallel
   */
  const sendMessages = useCallback(async (messages) => {
    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      const promises = messages.map(({ messageType, payload }) =>
        agentManager.sendMessage(agentName, messageType, payload)
      );
      
      const responses = await Promise.all(promises);
      
      const results = responses.map((response, index) => ({
        messageType: messages[index].messageType,
        success: response.success,
        data: response.data,
        error: response.error
      }));
      
      const hasErrors = results.some(r => !r.success);
      
      if (hasErrors) {
        const errors = results
          .filter(r => !r.success)
          .map(r => r.error)
          .join(', ');
        setError(errors);
      } else {
        setError(null);
      }
      
      setData(results);
      return results;
      
    } catch (err) {
      const errorMessage = err.message || 'Unknown error';
      setError(errorMessage);
      setData(null);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [agentName]);

  /**
   * Broadcast a message to all agents
   */
  const broadcast = useCallback(async (messageType, payload = {}) => {
    setLoading(true);
    setError(null);
    setData(null);
    setLastMessage({ type: messageType, payload, broadcast: true, timestamp: Date.now() });

    try {
      const results = await agentManager.broadcast(messageType, payload);
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      setData({
        results,
        successCount,
        errorCount,
        totalAgents: results.length
      });
      
      if (errorCount > 0) {
        const errors = results
          .filter(r => !r.success)
          .map(r => `${r.agent}: ${r.error}`)
          .join(', ');
        setError(`Some agents failed: ${errors}`);
      } else {
        setError(null);
      }
      
      return {
        success: errorCount === 0,
        data: {
          results,
          successCount,
          errorCount
        }
      };
      
    } catch (err) {
      const errorMessage = err.message || 'Broadcast failed';
      setError(errorMessage);
      setData(null);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Cancel any ongoing request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setError('Request cancelled');
    }
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
    setLastMessage(null);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    sendMessage,
    sendMessages,
    broadcast,
    cancel,
    reset,
    loading,
    error,
    data,
    lastMessage
  };
}

/**
 * Hook for subscribing to specific message types
 * 
 * @param {string|string[]} messageTypes - Message types to listen for
 * @param {function} callback - Callback function to handle messages
 * @param {object} options - Options for the subscription
 * 
 * @example
 * ```jsx
 * function ActivityTracker() {
 *   const [activities, setActivities] = useState([]);
 *   
 *   useAgentMessage.subscribe(['ACTIVITY_COMPLETED', 'ACTIVITY_STARTED'], (message) => {
 *     if (message.type === 'ACTIVITY_COMPLETED') {
 *       setActivities(prev => [message.payload.activity, ...prev]);
 *     }
 *   });
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
useAgentMessage.subscribe = function(messageTypes, callback, options = {}) {
  const { 
    agentFilter = null, // Filter messages from specific agents
    once = false // Only trigger callback once
  } = options;
  
  useEffect(() => {
    const types = Array.isArray(messageTypes) ? messageTypes : [messageTypes];
    let callbackTriggered = false;
    
    const handleMessage = (message) => {
      if (once && callbackTriggered) return;
      
      if (types.includes(message.type)) {
        if (!agentFilter || agentFilter.includes(message.from)) {
          callback(message);
          callbackTriggered = true;
        }
      }
    };

    // Subscribe to message bus events
    agentManager.messageBus.on('messageBroadcast', handleMessage);
    agentManager.messageBus.on('messageSent', handleMessage);

    return () => {
      agentManager.messageBus.off('messageBroadcast', handleMessage);
      agentManager.messageBus.off('messageSent', handleMessage);
    };
  }, [messageTypes, callback, agentFilter, once]);
};