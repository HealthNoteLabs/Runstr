import EventEmitter from 'events';

/**
 * Central message bus for inter-agent communication
 * Implements pub/sub pattern with message routing
 */
export class MessageBus extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.subscriptions = new Map();
    this.messageHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Register an agent with the message bus
   */
  registerAgent(agent) {
    if (this.agents.has(agent.name)) {
      throw new Error(`Agent ${agent.name} is already registered`);
    }
    
    this.agents.set(agent.name, agent);
    this.emit('agentRegistered', agent.name);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentName) {
    this.agents.delete(agentName);
    this.subscriptions.delete(agentName);
    this.emit('agentUnregistered', agentName);
  }

  /**
   * Check if an agent is registered
   */
  isAgentRegistered(agentName) {
    return this.agents.has(agentName);
  }

  /**
   * Send a message to a specific agent
   */
  async send(message) {
    const { to, from, type, payload } = message;
    
    // Validate sender
    if (!this.agents.has(from)) {
      throw new Error(`Sender agent ${from} is not registered`);
    }
    
    // Validate recipient
    const targetAgent = this.agents.get(to);
    if (!targetAgent) {
      throw new Error(`Target agent ${to} is not registered`);
    }
    
    // Add to history
    this.addToHistory(message);
    
    // Emit for monitoring
    this.emit('messageSent', message);
    
    // Deliver to target
    try {
      const response = await targetAgent.handleMessage(message);
      return { success: true, response };
    } catch (error) {
      console.error(`Error delivering message to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcast(message) {
    const { from, type, payload } = message;
    
    // Validate sender
    if (!this.agents.has(from)) {
      throw new Error(`Sender agent ${from} is not registered`);
    }
    
    // Add to history
    this.addToHistory({ ...message, to: '*' });
    
    // Emit for monitoring
    this.emit('messageBroadcast', message);
    
    // Deliver to all agents except sender
    const results = [];
    for (const [agentName, agent] of this.agents) {
      if (agentName !== from) {
        try {
          const response = await agent.handleMessage({ ...message, to: agentName });
          results.push({ agent: agentName, success: true, response });
        } catch (error) {
          results.push({ agent: agentName, success: false, error: error.message });
        }
      }
    }
    
    // Also check subscriptions
    const subscribers = this.subscriptions.get(type) || [];
    for (const { agentName, handler } of subscribers) {
      if (agentName !== from) {
        try {
          await handler(message);
        } catch (error) {
          console.error(`Subscription handler error for ${agentName}:`, error);
        }
      }
    }
    
    return results;
  }

  /**
   * Subscribe to messages of a specific type
   */
  subscribe(agentName, messageType, handler) {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} is not registered`);
    }
    
    if (!this.subscriptions.has(messageType)) {
      this.subscriptions.set(messageType, []);
    }
    
    this.subscriptions.get(messageType).push({ agentName, handler });
  }

  /**
   * Get message history
   */
  getHistory(filter = {}) {
    let history = [...this.messageHistory];
    
    if (filter.from) {
      history = history.filter(msg => msg.from === filter.from);
    }
    
    if (filter.to) {
      history = history.filter(msg => msg.to === filter.to);
    }
    
    if (filter.type) {
      history = history.filter(msg => msg.type === filter.type);
    }
    
    if (filter.since) {
      history = history.filter(msg => msg.timestamp >= filter.since);
    }
    
    return history;
  }

  /**
   * Add message to history
   */
  addToHistory(message) {
    this.messageHistory.push(message);
    
    // Trim history if it exceeds max size
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Clear message history
   */
  clearHistory() {
    this.messageHistory = [];
  }

  /**
   * Get all registered agents
   */
  getAgents() {
    return Array.from(this.agents.keys());
  }
}