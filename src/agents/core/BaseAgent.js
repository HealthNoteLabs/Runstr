import EventEmitter from 'events';

/**
 * Base Agent class that all agents extend from
 * Provides common functionality like message handling, state management, and lifecycle hooks
 */
export class BaseAgent extends EventEmitter {
  constructor(name, messageBus, options = {}) {
    super();
    this.name = name;
    this.messageBus = messageBus;
    this.state = {};
    this.version = options.version || '1.0.0';
    this.dependencies = options.dependencies || [];
    this.initialized = false;
    
    // Register with message bus
    this.messageBus.registerAgent(this);
  }

  /**
   * Initialize the agent - override in subclasses
   */
  async initialize() {
    if (this.initialized) return;
    
    // Check dependencies
    for (const dep of this.dependencies) {
      if (!this.messageBus.isAgentRegistered(dep)) {
        throw new Error(`Agent ${this.name} requires ${dep} to be initialized first`);
      }
    }
    
    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * Handle incoming messages - override in subclasses
   */
  async handleMessage(message) {
    console.warn(`Agent ${this.name} received unhandled message:`, message);
  }

  /**
   * Send a message to another agent
   */
  async sendMessage(targetAgent, type, payload) {
    return this.messageBus.send({
      from: this.name,
      to: targetAgent,
      type,
      payload,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcast(type, payload) {
    return this.messageBus.broadcast({
      from: this.name,
      type,
      payload,
      timestamp: Date.now()
    });
  }

  /**
   * Subscribe to messages of a specific type
   */
  subscribe(messageType, handler) {
    this.messageBus.subscribe(this.name, messageType, handler);
  }

  /**
   * Update agent state
   */
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.emit('stateChanged', this.state);
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Cleanup when agent is destroyed
   */
  async destroy() {
    this.messageBus.unregisterAgent(this.name);
    this.removeAllListeners();
    this.initialized = false;
  }
}