import { BaseAgent } from './core/BaseAgent.js';
import { MessageTypes, AgentResponse, ErrorCodes, AgentError } from './core/AgentInterface.js';

/**
 * Core Services Agent
 * Handles shared functionality like Nostr operations, authentication, and relay management
 */
export class CoreServicesAgent extends BaseAgent {
  constructor(messageBus, options = {}) {
    super('CoreServices', messageBus, {
      version: '1.0.0',
      dependencies: [],
      ...options
    });
    
    this.nostrContext = null;
    this.relayManager = null;
    this.authState = {
      isAuthenticated: false,
      publicKey: null,
      signer: null
    };
  }

  async initialize() {
    await super.initialize();
    
    // Set up message handlers
    this.subscribe(MessageTypes.USER_LOGIN, this.handleUserLogin.bind(this));
    this.subscribe(MessageTypes.USER_LOGOUT, this.handleUserLogout.bind(this));
    this.subscribe(MessageTypes.DATA_REQUEST, this.handleDataRequest.bind(this));
    
    this.setState({
      ready: true,
      connectedRelays: [],
      authState: this.authState
    });
  }

  async handleMessage(message) {
    const { type, payload } = message;
    
    try {
      switch (type) {
        case 'nostr.connect':
          return await this.handleNostrConnect(payload);
          
        case 'nostr.publish':
          return await this.handleNostrPublish(payload);
          
        case 'nostr.fetch':
          return await this.handleNostrFetch(payload);
          
        case 'auth.getState':
          return new AgentResponse({
            success: true,
            data: this.authState,
            correlationId: message.correlationId
          });
          
        case 'relay.connect':
          return await this.handleRelayConnect(payload);
          
        case 'relay.disconnect':
          return await this.handleRelayDisconnect(payload);
          
        case 'relay.list':
          return new AgentResponse({
            success: true,
            data: this.getConnectedRelays(),
            correlationId: message.correlationId
          });
          
        default:
          return new AgentResponse({
            success: false,
            error: `Unknown message type: ${type}`,
            correlationId: message.correlationId
          });
      }
    } catch (error) {
      return new AgentResponse({
        success: false,
        error: error.message,
        correlationId: message.correlationId
      });
    }
  }

  /**
   * Handle Nostr connection
   */
  async handleNostrConnect(payload) {
    try {
      // Get NDK instance from singleton
      const { ndkSingleton } = await import('../lib/ndkSingleton.js');
      const ndk = await ndkSingleton;
      
      if (!ndk) {
        throw new AgentError('NDK not available', ErrorCodes.INITIALIZATION_ERROR);
      }
      
      this.nostrContext = ndk;
      
      // Update auth state if we have a signer
      if (ndk.signer) {
        const user = await ndk.signer.user();
        this.authState = {
          isAuthenticated: true,
          publicKey: user.pubkey,
          signer: ndk.signer
        };
      }
      
      this.setState({ 
        nostrConnected: true,
        authState: this.authState
      });
      
      // Broadcast connection status
      await this.broadcast(MessageTypes.AGENT_STATE_CHANGED, {
        agent: 'CoreServices',
        state: 'nostrConnected',
        data: { connected: true }
      });
      
      return new AgentResponse({
        success: true,
        data: { connected: true, relayCount: ndk.explicitRelayUrls?.length || 0 }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to connect to Nostr: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Handle Nostr event publishing
   */
  async handleNostrPublish(payload) {
    if (!this.nostrContext) {
      throw new AgentError('Nostr not connected', ErrorCodes.COMMUNICATION_ERROR);
    }
    
    if (!this.authState.isAuthenticated) {
      throw new AgentError('User not authenticated', ErrorCodes.UNAUTHORIZED);
    }
    
    try {
      const { NDKEvent } = await import('@nostr-dev-kit/ndk');
      const event = new NDKEvent(this.nostrContext, payload.event);
      
      if (payload.sign !== false) {
        await event.sign();
      }
      
      const result = await event.publish();
      
      return new AgentResponse({
        success: true,
        data: { 
          eventId: event.id,
          published: true,
          relayResults: result
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to publish event: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Handle Nostr data fetching
   */
  async handleNostrFetch(payload) {
    if (!this.nostrContext) {
      throw new AgentError('Nostr not connected', ErrorCodes.COMMUNICATION_ERROR);
    }
    
    try {
      const { filter, limit = 100 } = payload;
      const events = await this.nostrContext.fetchEvents(filter, { limit });
      
      return new AgentResponse({
        success: true,
        data: Array.from(events).map(event => ({
          id: event.id,
          kind: event.kind,
          content: event.content,
          tags: event.tags,
          created_at: event.created_at,
          pubkey: event.pubkey,
          sig: event.sig
        }))
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to fetch events: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Handle user login
   */
  async handleUserLogin(message) {
    const { payload } = message;
    
    try {
      // Update auth state
      this.authState = {
        isAuthenticated: true,
        publicKey: payload.publicKey,
        signer: payload.signer
      };
      
      this.setState({ authState: this.authState });
      
      // Broadcast login event
      await this.broadcast(MessageTypes.USER_LOGIN, {
        publicKey: payload.publicKey
      });
      
    } catch (error) {
      console.error('Login handling error:', error);
    }
  }

  /**
   * Handle user logout
   */
  async handleUserLogout(message) {
    try {
      this.authState = {
        isAuthenticated: false,
        publicKey: null,
        signer: null
      };
      
      this.setState({ authState: this.authState });
      
      // Broadcast logout event
      await this.broadcast(MessageTypes.USER_LOGOUT, {});
      
    } catch (error) {
      console.error('Logout handling error:', error);
    }
  }

  /**
   * Handle data requests from other agents
   */
  async handleDataRequest(message) {
    const { payload } = message;
    const { type, params } = payload;
    
    switch (type) {
      case 'profile':
        return await this.fetchProfile(params.pubkey);
        
      case 'events':
        return await this.handleNostrFetch({ filter: params.filter, limit: params.limit });
        
      case 'relays':
        return new AgentResponse({
          success: true,
          data: this.getConnectedRelays()
        });
        
      default:
        throw new AgentError(`Unknown data request type: ${type}`, ErrorCodes.INVALID_MESSAGE);
    }
  }

  /**
   * Fetch user profile
   */
  async fetchProfile(pubkey) {
    if (!this.nostrContext) {
      throw new AgentError('Nostr not connected', ErrorCodes.COMMUNICATION_ERROR);
    }
    
    try {
      const user = this.nostrContext.getUser({ pubkey });
      await user.fetchProfile();
      
      return new AgentResponse({
        success: true,
        data: {
          pubkey: user.pubkey,
          profile: user.profile
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to fetch profile: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Handle relay connection
   */
  async handleRelayConnect(payload) {
    if (!this.nostrContext) {
      throw new AgentError('Nostr not connected', ErrorCodes.COMMUNICATION_ERROR);
    }
    
    try {
      const { url } = payload;
      const relay = this.nostrContext.addExplicitRelay(url);
      await relay.connect();
      
      return new AgentResponse({
        success: true,
        data: { url, connected: true }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to connect to relay: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Handle relay disconnection
   */
  async handleRelayDisconnect(payload) {
    if (!this.nostrContext) {
      throw new AgentError('Nostr not connected', ErrorCodes.COMMUNICATION_ERROR);
    }
    
    try {
      const { url } = payload;
      const relay = this.nostrContext.explicitRelays.get(url);
      if (relay) {
        relay.disconnect();
      }
      
      return new AgentResponse({
        success: true,
        data: { url, disconnected: true }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to disconnect from relay: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get connected relays
   */
  getConnectedRelays() {
    if (!this.nostrContext) return [];
    
    return Array.from(this.nostrContext.explicitRelays.entries()).map(([url, relay]) => ({
      url,
      connected: relay.connectivity.status === 1, // NDKRelayStatus.CONNECTED
      stats: relay.stats
    }));
  }
}