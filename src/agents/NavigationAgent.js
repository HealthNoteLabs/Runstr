import { BaseAgent } from './core/BaseAgent.js';
import { MessageTypes, AgentResponse, ErrorCodes, AgentError } from './core/AgentInterface.js';

/**
 * Navigation Agent
 * Handles cross-tab coordination, route management, and state synchronization
 */
export class NavigationAgent extends BaseAgent {
  constructor(messageBus, options = {}) {
    super('Navigation', messageBus, {
      version: '1.0.0',
      dependencies: [],
      ...options
    });
    
    this.currentRoute = '/';
    this.routeHistory = [];
    this.navigationState = {};
    this.tabStates = new Map();
    this.routeParams = {};
    this.queryParams = {};
  }

  async initialize() {
    await super.initialize();
    
    // Set up message handlers
    this.subscribe(MessageTypes.TAB_CHANGED, this.handleTabChanged.bind(this));
    this.subscribe(MessageTypes.NAVIGATE_TO, this.handleNavigateTo.bind(this));
    this.subscribe(MessageTypes.AGENT_STATE_CHANGED, this.handleAgentStateChanged.bind(this));
    
    // Initialize route state
    await this.initializeRouteState();
    
    this.setState({
      ready: true,
      currentRoute: this.currentRoute,
      navigationState: this.navigationState,
      routeHistory: this.routeHistory
    });
  }

  async handleMessage(message) {
    const { type, payload } = message;
    
    try {
      switch (type) {
        case 'navigation.getCurrentRoute':
          return this.getCurrentRoute();
          
        case 'navigation.navigateTo':
          return await this.navigateTo(payload);
          
        case 'navigation.goBack':
          return await this.goBack();
          
        case 'navigation.goForward':
          return await this.goForward();
          
        case 'navigation.getHistory':
          return this.getHistory();
          
        case 'navigation.clearHistory':
          return this.clearHistory();
          
        case 'state.sync':
          return await this.syncState(payload);
          
        case 'state.get':
          return this.getState(payload);
          
        case 'state.set':
          return await this.setStateValue(payload);
          
        case 'tab.getState':
          return this.getTabState(payload);
          
        case 'tab.setState':
          return await this.setTabState(payload);
          
        case 'route.getParams':
          return this.getRouteParams();
          
        case 'route.setParams':
          return await this.setRouteParams(payload);
          
        case 'query.getParams':
          return this.getQueryParams();
          
        case 'query.setParams':
          return await this.setQueryParams(payload);
          
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
   * Get current route
   */
  getCurrentRoute() {
    return new AgentResponse({
      success: true,
      data: {
        route: this.currentRoute,
        params: this.routeParams,
        query: this.queryParams,
        state: this.navigationState
      }
    });
  }

  /**
   * Navigate to a new route
   */
  async navigateTo(payload) {
    const { 
      route, 
      params = {}, 
      query = {}, 
      state = {}, 
      replace = false,
      notify = true 
    } = payload;
    
    if (!route) {
      throw new AgentError('Route is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      // Validate route
      if (!this.isValidRoute(route)) {
        throw new AgentError('Invalid route', ErrorCodes.VALIDATION_ERROR);
      }
      
      const previousRoute = this.currentRoute;
      const previousParams = { ...this.routeParams };
      const previousQuery = { ...this.queryParams };
      const previousState = { ...this.navigationState };
      
      // Update current route
      this.currentRoute = route;
      this.routeParams = { ...params };
      this.queryParams = { ...query };
      this.navigationState = { ...this.navigationState, ...state };
      
      // Update history
      if (!replace) {
        this.routeHistory.push({
          route: previousRoute,
          params: previousParams,
          query: previousQuery,
          state: previousState,
          timestamp: Date.now()
        });
        
        // Limit history size
        if (this.routeHistory.length > 50) {
          this.routeHistory = this.routeHistory.slice(-50);
        }
      }
      
      // Update agent state
      this.setState({
        currentRoute: this.currentRoute,
        routeParams: this.routeParams,
        queryParams: this.queryParams,
        navigationState: this.navigationState,
        routeHistory: this.routeHistory
      });
      
      // Notify other agents if requested
      if (notify) {
        await this.broadcast(MessageTypes.NAVIGATE_TO, {
          route: this.currentRoute,
          params: this.routeParams,
          query: this.queryParams,
          state: this.navigationState,
          previousRoute,
          previousParams,
          previousQuery,
          previousState
        });
        
        await this.broadcast(MessageTypes.TAB_CHANGED, {
          currentTab: this.getTabFromRoute(route),
          previousTab: this.getTabFromRoute(previousRoute),
          route: this.currentRoute
        });
      }
      
      // Update browser history if available
      await this.updateBrowserHistory(route, params, query, state, replace);
      
      return new AgentResponse({
        success: true,
        data: {
          navigated: true,
          route: this.currentRoute,
          params: this.routeParams,
          query: this.queryParams
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to navigate: ${error.message}`,
        ErrorCodes.NAVIGATION_ERROR
      );
    }
  }

  /**
   * Go back in history
   */
  async goBack() {
    if (this.routeHistory.length === 0) {
      return new AgentResponse({
        success: false,
        error: 'No history to go back to'
      });
    }
    
    try {
      const previousEntry = this.routeHistory.pop();
      
      await this.navigateTo({
        route: previousEntry.route,
        params: previousEntry.params,
        query: previousEntry.query,
        state: previousEntry.state,
        replace: true,
        notify: true
      });
      
      return new AgentResponse({
        success: true,
        data: {
          navigated: true,
          direction: 'back',
          route: this.currentRoute
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to go back: ${error.message}`,
        ErrorCodes.NAVIGATION_ERROR
      );
    }
  }

  /**
   * Go forward (placeholder for future implementation)
   */
  async goForward() {
    // For now, forward navigation is not implemented
    // Could be added with a forward history stack
    
    return new AgentResponse({
      success: false,
      error: 'Forward navigation not available'
    });
  }

  /**
   * Get navigation history
   */
  getHistory() {
    return new AgentResponse({
      success: true,
      data: {
        history: [...this.routeHistory],
        currentRoute: this.currentRoute
      }
    });
  }

  /**
   * Clear navigation history
   */
  clearHistory() {
    this.routeHistory = [];
    this.setState({ routeHistory: this.routeHistory });
    
    return new AgentResponse({
      success: true,
      data: { cleared: true }
    });
  }

  /**
   * Sync state across agents
   */
  async syncState(payload) {
    const { agentName, state } = payload;
    
    if (!agentName) {
      throw new AgentError('Agent name is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    // Store agent state
    this.tabStates.set(agentName, {
      ...state,
      lastSync: Date.now()
    });
    
    // Broadcast state sync
    await this.broadcast(MessageTypes.AGENT_STATE_CHANGED, {
      agent: agentName,
      state,
      source: 'navigation'
    });
    
    return new AgentResponse({
      success: true,
      data: { synced: true, agent: agentName }
    });
  }

  /**
   * Get global navigation state
   */
  getState(payload = {}) {
    const { key } = payload;
    
    if (key) {
      return new AgentResponse({
        success: true,
        data: { 
          key, 
          value: this.navigationState[key] 
        }
      });
    }
    
    return new AgentResponse({
      success: true,
      data: { state: { ...this.navigationState } }
    });
  }

  /**
   * Set global navigation state value
   */
  async setStateValue(payload) {
    const { key, value } = payload;
    
    if (!key) {
      throw new AgentError('State key is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    const oldValue = this.navigationState[key];
    this.navigationState[key] = value;
    
    this.setState({ navigationState: this.navigationState });
    
    // Broadcast state change
    await this.broadcast(MessageTypes.AGENT_STATE_CHANGED, {
      agent: 'Navigation',
      state: { [key]: value },
      key,
      value,
      oldValue
    });
    
    return new AgentResponse({
      success: true,
      data: { key, value, changed: true }
    });
  }

  /**
   * Get tab-specific state
   */
  getTabState(payload) {
    const { tabName } = payload;
    
    if (!tabName) {
      throw new AgentError('Tab name is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    const tabState = this.tabStates.get(tabName) || {};
    
    return new AgentResponse({
      success: true,
      data: { 
        tab: tabName,
        state: tabState 
      }
    });
  }

  /**
   * Set tab-specific state
   */
  async setTabState(payload) {
    const { tabName, state } = payload;
    
    if (!tabName) {
      throw new AgentError('Tab name is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    const currentState = this.tabStates.get(tabName) || {};
    const newState = {
      ...currentState,
      ...state,
      lastUpdated: Date.now()
    };
    
    this.tabStates.set(tabName, newState);
    
    // Broadcast tab state change
    await this.broadcast(MessageTypes.AGENT_STATE_CHANGED, {
      agent: tabName,
      state: newState,
      source: 'navigation'
    });
    
    return new AgentResponse({
      success: true,
      data: { 
        tab: tabName,
        state: newState,
        updated: true 
      }
    });
  }

  /**
   * Get route parameters
   */
  getRouteParams() {
    return new AgentResponse({
      success: true,
      data: { params: { ...this.routeParams } }
    });
  }

  /**
   * Set route parameters
   */
  async setRouteParams(payload) {
    const { params } = payload;
    
    if (!params || typeof params !== 'object') {
      throw new AgentError('Route params must be an object', ErrorCodes.VALIDATION_ERROR);
    }
    
    this.routeParams = { ...this.routeParams, ...params };
    
    this.setState({ routeParams: this.routeParams });
    
    return new AgentResponse({
      success: true,
      data: { 
        params: this.routeParams,
        updated: true 
      }
    });
  }

  /**
   * Get query parameters
   */
  getQueryParams() {
    return new AgentResponse({
      success: true,
      data: { query: { ...this.queryParams } }
    });
  }

  /**
   * Set query parameters
   */
  async setQueryParams(payload) {
    const { query, merge = true } = payload;
    
    if (!query || typeof query !== 'object') {
      throw new AgentError('Query params must be an object', ErrorCodes.VALIDATION_ERROR);
    }
    
    this.queryParams = merge 
      ? { ...this.queryParams, ...query }
      : { ...query };
    
    this.setState({ queryParams: this.queryParams });
    
    // Update browser URL if available
    await this.updateBrowserQuery(this.queryParams);
    
    return new AgentResponse({
      success: true,
      data: { 
        query: this.queryParams,
        updated: true 
      }
    });
  }

  /**
   * Initialize route state from browser
   */
  async initializeRouteState() {
    try {
      if (typeof window !== 'undefined' && window.location) {
        this.currentRoute = window.location.pathname;
        
        // Parse query parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.queryParams = Object.fromEntries(urlParams.entries());
        
        // Set up browser history listener
        window.addEventListener('popstate', (event) => {
          this.handleBrowserNavigation(event);
        });
      }
    } catch (error) {
      console.warn('Failed to initialize route state:', error);
    }
  }

  /**
   * Handle browser navigation events
   */
  async handleBrowserNavigation(event) {
    try {
      const newRoute = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      const newQuery = Object.fromEntries(urlParams.entries());
      const newState = event.state || {};
      
      if (newRoute !== this.currentRoute) {
        await this.navigateTo({
          route: newRoute,
          query: newQuery,
          state: newState,
          replace: true,
          notify: true
        });
      }
    } catch (error) {
      console.error('Failed to handle browser navigation:', error);
    }
  }

  /**
   * Update browser history
   */
  async updateBrowserHistory(route, params, query, state, replace) {
    try {
      if (typeof window !== 'undefined' && window.history) {
        const url = this.buildUrl(route, query);
        const method = replace ? 'replaceState' : 'pushState';
        
        window.history[method](
          { ...state, params },
          '',
          url
        );
      }
    } catch (error) {
      console.warn('Failed to update browser history:', error);
    }
  }

  /**
   * Update browser query parameters
   */
  async updateBrowserQuery(query) {
    try {
      if (typeof window !== 'undefined' && window.history) {
        const url = this.buildUrl(this.currentRoute, query);
        window.history.replaceState(window.history.state, '', url);
      }
    } catch (error) {
      console.warn('Failed to update browser query:', error);
    }
  }

  /**
   * Build URL from route and query parameters
   */
  buildUrl(route, query = {}) {
    const queryString = Object.keys(query).length > 0 
      ? '?' + new URLSearchParams(query).toString()
      : '';
    
    return route + queryString;
  }

  /**
   * Validate route
   */
  isValidRoute(route) {
    // Define valid routes
    const validRoutes = [
      '/',
      '/profile',
      '/nostr-stats',
      '/history',
      '/club',
      '/teams',
      '/music',
      '/wallet',
      '/settings',
      '/team-detail'
    ];
    
    // Check exact matches or parameterized routes
    return validRoutes.includes(route) || 
           route.startsWith('/team-detail/') ||
           route.startsWith('/profile/');
  }

  /**
   * Get tab name from route
   */
  getTabFromRoute(route) {
    const routeToTab = {
      '/': 'dashboard',
      '/profile': 'profile',
      '/nostr-stats': 'profile',
      '/history': 'profile',
      '/club': 'league',
      '/teams': 'teams',
      '/music': 'music',
      '/wallet': 'settings',
      '/settings': 'settings'
    };
    
    return routeToTab[route] || 'dashboard';
  }

  /**
   * Handle tab changed event
   */
  async handleTabChanged(message) {
    const { payload } = message;
    
    // Update tab state if needed
    if (payload.currentTab) {
      await this.setTabState({
        tabName: payload.currentTab,
        state: { active: true, lastActivated: Date.now() }
      });
    }
    
    if (payload.previousTab && payload.previousTab !== payload.currentTab) {
      await this.setTabState({
        tabName: payload.previousTab,
        state: { active: false, lastDeactivated: Date.now() }
      });
    }
  }

  /**
   * Handle navigate to event
   */
  async handleNavigateTo(message) {
    const { payload } = message;
    
    // If this navigation wasn't initiated by this agent, update our state
    if (message.from !== 'Navigation') {
      this.currentRoute = payload.route;
      this.routeParams = payload.params || {};
      this.queryParams = payload.query || {};
      this.navigationState = { ...this.navigationState, ...payload.state };
      
      this.setState({
        currentRoute: this.currentRoute,
        routeParams: this.routeParams,
        queryParams: this.queryParams,
        navigationState: this.navigationState
      });
    }
  }

  /**
   * Handle agent state changed event
   */
  async handleAgentStateChanged(message) {
    const { payload } = message;
    
    // Store agent states for coordination
    if (payload.agent && payload.state) {
      this.tabStates.set(payload.agent, {
        ...this.tabStates.get(payload.agent),
        ...payload.state,
        lastSync: Date.now()
      });
    }
  }
}