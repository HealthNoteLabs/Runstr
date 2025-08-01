import { MessageBus } from './core/MessageBus.js';
import { CoreServicesAgent } from './CoreServicesAgent.js';
import { TeamsAgent } from './TeamsAgent.js';
import { DashboardAgent } from './DashboardAgent.js';
import { ProfileAgent } from './ProfileAgent.js';
import { LeagueAgent } from './LeagueAgent.js';
import { MusicAgent } from './MusicAgent.js';
import { SettingsAgent } from './SettingsAgent.js';
import { NavigationAgent } from './NavigationAgent.js';

/**
 * Agent Manager
 * Manages the lifecycle and coordination of all agents in the system
 */
export class AgentManager {
  constructor() {
    this.messageBus = new MessageBus();
    this.agents = new Map();
    this.initialized = false;
    this.startupOrder = [
      'CoreServices',
      'Settings', 
      'Navigation',
      'Dashboard',
      'Profile',
      'Teams',
      'League',
      'Music'
    ];
  }

  /**
   * Initialize all agents in the correct order
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🚀 Initializing Agent System...');

      // Create all agents
      await this.createAgents();

      // Initialize agents in dependency order
      await this.initializeAgents();

      // Set up global error handling
      this.setupErrorHandling();

      // Set up health monitoring
      this.setupHealthMonitoring();

      this.initialized = true;
      console.log('✅ Agent System initialized successfully');

      // Broadcast system ready
      await this.messageBus.broadcast({
        from: 'AgentManager',
        type: 'system.ready',
        payload: {
          agents: Array.from(this.agents.keys()),
          timestamp: Date.now()
        }
      });

    } catch (error) {
      console.error('❌ Failed to initialize Agent System:', error);
      throw error;
    }
  }

  /**
   * Create all agent instances
   */
  async createAgents() {
    const agentConfigs = [
      { name: 'CoreServices', AgentClass: CoreServicesAgent },
      { name: 'Settings', AgentClass: SettingsAgent },
      { name: 'Navigation', AgentClass: NavigationAgent },
      { name: 'Dashboard', AgentClass: DashboardAgent },
      { name: 'Profile', AgentClass: ProfileAgent },
      { name: 'Teams', AgentClass: TeamsAgent },
      { name: 'League', AgentClass: LeagueAgent },
      { name: 'Music', AgentClass: MusicAgent }
    ];

    for (const { name, AgentClass } of agentConfigs) {
      try {
        const agent = new AgentClass(this.messageBus);
        this.agents.set(name, agent);
        console.log(`📦 Created ${name} agent`);
      } catch (error) {
        console.error(`❌ Failed to create ${name} agent:`, error);
        throw error;
      }
    }
  }

  /**
   * Initialize agents in dependency order
   */
  async initializeAgents() {
    for (const agentName of this.startupOrder) {
      const agent = this.agents.get(agentName);
      if (!agent) {
        throw new Error(`Agent ${agentName} not found`);
      }

      try {
        console.log(`🔧 Initializing ${agentName} agent...`);
        await agent.initialize();
        console.log(`✅ ${agentName} agent initialized`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${agentName} agent:`, error);
        throw error;
      }
    }
  }

  /**
   * Get an agent by name
   */
  getAgent(name) {
    return this.agents.get(name);
  }

  /**
   * Get all agents
   */
  getAllAgents() {
    return new Map(this.agents);
  }

  /**
   * Send a message to a specific agent
   */
  async sendMessage(agentName, messageType, payload) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    return await this.messageBus.send({
      from: 'AgentManager',
      to: agentName,
      type: messageType,
      payload,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcast(messageType, payload) {
    return await this.messageBus.broadcast({
      from: 'AgentManager',
      type: messageType,
      payload,
      timestamp: Date.now()
    });
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    const agentStatuses = {};
    
    for (const [name, agent] of this.agents) {
      agentStatuses[name] = {
        initialized: agent.initialized,
        version: agent.version,
        dependencies: agent.dependencies,
        state: agent.getState()
      };
    }

    return {
      initialized: this.initialized,
      agentCount: this.agents.size,
      messageBusStats: {
        registeredAgents: this.messageBus.getAgents().length,
        messageHistory: this.messageBus.getHistory().length
      },
      agents: agentStatuses
    };
  }

  /**
   * Restart a specific agent
   */
  async restartAgent(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    try {
      console.log(`🔄 Restarting ${agentName} agent...`);
      
      // Destroy current agent
      await agent.destroy();
      
      // Get agent class
      const AgentClass = agent.constructor;
      
      // Create new instance
      const newAgent = new AgentClass(this.messageBus);
      this.agents.set(agentName, newAgent);
      
      // Initialize
      await newAgent.initialize();
      
      console.log(`✅ ${agentName} agent restarted successfully`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to restart ${agentName} agent:`, error);
      throw error;
    }
  }

  /**
   * Shutdown the agent system
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }

    try {
      console.log('🛑 Shutting down Agent System...');

      // Broadcast shutdown notification
      await this.broadcast('system.shutdown', {
        timestamp: Date.now()
      });

      // Shutdown agents in reverse order
      const shutdownOrder = [...this.startupOrder].reverse();
      
      for (const agentName of shutdownOrder) {
        const agent = this.agents.get(agentName);
        if (agent) {
          try {
            console.log(`🔌 Shutting down ${agentName} agent...`);
            await agent.destroy();
            console.log(`✅ ${agentName} agent shut down`);
          } catch (error) {
            console.error(`❌ Error shutting down ${agentName} agent:`, error);
          }
        }
      }

      // Clear agents
      this.agents.clear();
      
      // Clean up message bus
      this.messageBus.clearHistory();

      this.initialized = false;
      console.log('✅ Agent System shut down successfully');

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Set up global error handling
   */
  setupErrorHandling() {
    this.messageBus.on('messageBroadcast', (message) => {
      // Log important system messages
      if (message.type.startsWith('system.') || message.type.startsWith('error.')) {
        console.log('📡 System Message:', message);
      }
    });

    this.messageBus.on('messageSent', (message) => {
      // Log failed message deliveries
      if (message.error) {
        console.error('📧 Message Delivery Failed:', message);
      }
    });

    // Handle unhandled errors from agents
    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Promise Rejection in Agent System:', reason);
      
      // Broadcast error to agents for potential recovery
      this.broadcast('system.error', {
        type: 'unhandledRejection',
        reason: reason.toString(),
        timestamp: Date.now()
      }).catch(console.error);
    });
  }

  /**
   * Set up health monitoring
   */
  setupHealthMonitoring() {
    // Periodic health check
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('❤️ Health check failed:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Perform health check on all agents
   */
  async performHealthCheck() {
    const unhealthyAgents = [];

    for (const [name, agent] of this.agents) {
      try {
        // Check if agent is responsive
        const response = await Promise.race([
          this.sendMessage(name, 'health.check', {}),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);

        if (!response.success) {
          unhealthyAgents.push(name);
        }
      } catch (error) {
        console.warn(`⚠️ Health check failed for ${name} agent:`, error.message);
        unhealthyAgents.push(name);
      }
    }

    if (unhealthyAgents.length > 0) {
      console.warn('⚠️ Unhealthy agents detected:', unhealthyAgents);
      
      // Broadcast health issue notification
      await this.broadcast('system.health.warning', {
        unhealthyAgents,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get message bus statistics
   */
  getMessageBusStats() {
    return {
      registeredAgents: this.messageBus.getAgents(),
      messageHistory: this.messageBus.getHistory({ since: Date.now() - 60000 }), // Last minute
      subscriptions: Array.from(this.messageBus.subscriptions.entries())
    };
  }

  /**
   * Enable debug mode
   */
  enableDebugMode() {
    // Add detailed logging
    this.messageBus.on('messageSent', (message) => {
      console.debug('🔍 Message Sent:', {
        from: message.from,
        to: message.to,
        type: message.type,
        timestamp: new Date(message.timestamp).toISOString()
      });
    });

    this.messageBus.on('messageBroadcast', (message) => {
      console.debug('📢 Message Broadcast:', {
        from: message.from,
        type: message.type,
        timestamp: new Date(message.timestamp).toISOString()
      });
    });

    console.log('🐛 Debug mode enabled for Agent System');
  }

  /**
   * Disable debug mode
   */
  disableDebugMode() {
    this.messageBus.removeAllListeners('messageSent');
    this.messageBus.removeAllListeners('messageBroadcast');
    console.log('🐛 Debug mode disabled for Agent System');
  }
}

// Create singleton instance
export const agentManager = new AgentManager();