import { BaseAgent } from './core/BaseAgent.js';
import { MessageTypes, AgentResponse, ErrorCodes, AgentError } from './core/AgentInterface.js';

/**
 * Settings Agent
 * Handles application configuration, user preferences, and settings management
 */
export class SettingsAgent extends BaseAgent {
  constructor(messageBus, options = {}) {
    super('Settings', messageBus, {
      version: '1.0.0',
      dependencies: ['CoreServices'],
      ...options
    });
    
    this.settings = new Map();
    this.defaultSettings = {
      // Activity settings
      distanceUnit: 'km',
      activityMode: 'run',
      skipStartCountdown: false,
      usePedometer: false,
      useLocalStats: false,
      
      // Nostr settings
      autoPostToNostr: true,
      autoPostKind1Note: false,
      healthEncryptionPref: 'encrypted',
      publishMode: 'public',
      privateRelayUrl: '',
      
      // Music settings
      blossomEndpoint: '',
      musicVolume: 0.8,
      
      // UI settings
      theme: 'auto',
      notifications: true,
      
      // Privacy settings
      shareLocation: false,
      shareHealthData: false
    };
  }

  async initialize() {
    await super.initialize();
    
    // Set up message handlers
    this.subscribe(MessageTypes.USER_LOGIN, this.handleUserLogin.bind(this));
    this.subscribe(MessageTypes.USER_LOGOUT, this.handleUserLogout.bind(this));
    
    // Load settings from local storage
    await this.loadSettings();
    
    this.setState({
      ready: true,
      settings: Object.fromEntries(this.settings)
    });
  }

  async handleMessage(message) {
    const { type, payload } = message;
    
    try {
      switch (type) {
        case 'settings.get':
          return this.getSetting(payload);
          
        case 'settings.set':
          return await this.setSetting(payload);
          
        case 'settings.getAll':
          return this.getAllSettings();
          
        case 'settings.setMultiple':
          return await this.setMultipleSettings(payload);
          
        case 'settings.reset':
          return await this.resetSettings(payload);
          
        case 'settings.export':
          return this.exportSettings();
          
        case 'settings.import':
          return await this.importSettings(payload);
          
        case 'preferences.get':
          return this.getPreference(payload);
          
        case 'preferences.set':
          return await this.setPreference(payload);
          
        case 'theme.set':
          return await this.setTheme(payload);
          
        case 'theme.get':
          return this.getTheme();
          
        case 'notifications.toggle':
          return await this.toggleNotifications(payload);
          
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
   * Get a specific setting
   */
  getSetting(payload) {
    const { key } = payload;
    
    if (!key) {
      throw new AgentError('Setting key is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    const value = this.settings.has(key) ? 
      this.settings.get(key) : 
      this.defaultSettings[key];
    
    return new AgentResponse({
      success: true,
      data: { key, value }
    });
  }

  /**
   * Set a specific setting
   */
  async setSetting(payload) {
    const { key, value } = payload;
    
    if (!key) {
      throw new AgentError('Setting key is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      // Validate setting value
      const validationResult = this.validateSetting(key, value);
      if (!validationResult.valid) {
        throw new AgentError(validationResult.error, ErrorCodes.VALIDATION_ERROR);
      }
      
      const oldValue = this.settings.get(key);
      this.settings.set(key, value);
      
      // Persist to local storage
      await this.persistSettings();
      
      // Update state
      this.setState({ settings: Object.fromEntries(this.settings) });
      
      // Broadcast setting change
      await this.broadcast(MessageTypes.SETTINGS_CHANGED, {
        key,
        value,
        oldValue
      });
      
      // Handle special settings that require additional actions
      await this.handleSpecialSetting(key, value, oldValue);
      
      return new AgentResponse({
        success: true,
        data: { key, value, changed: true }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to set setting: ${error.message}`,
        ErrorCodes.STATE_ERROR
      );
    }
  }

  /**
   * Get all settings
   */
  getAllSettings() {
    const allSettings = {};
    
    // Include defaults for missing settings
    for (const [key, defaultValue] of Object.entries(this.defaultSettings)) {
      allSettings[key] = this.settings.has(key) ? this.settings.get(key) : defaultValue;
    }
    
    // Include custom settings
    for (const [key, value] of this.settings) {
      if (!(key in this.defaultSettings)) {
        allSettings[key] = value;
      }
    }
    
    return new AgentResponse({
      success: true,
      data: { settings: allSettings }
    });
  }

  /**
   * Set multiple settings at once
   */
  async setMultipleSettings(payload) {
    const { settings } = payload;
    
    if (!settings || typeof settings !== 'object') {
      throw new AgentError('Settings object is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      const changes = [];
      
      for (const [key, value] of Object.entries(settings)) {
        const validationResult = this.validateSetting(key, value);
        if (!validationResult.valid) {
          throw new AgentError(`Invalid setting ${key}: ${validationResult.error}`, ErrorCodes.VALIDATION_ERROR);
        }
        
        const oldValue = this.settings.get(key);
        this.settings.set(key, value);
        changes.push({ key, value, oldValue });
      }
      
      // Persist to local storage
      await this.persistSettings();
      
      // Update state
      this.setState({ settings: Object.fromEntries(this.settings) });
      
      // Broadcast changes
      for (const change of changes) {
        await this.broadcast(MessageTypes.SETTINGS_CHANGED, change);
        await this.handleSpecialSetting(change.key, change.value, change.oldValue);
      }
      
      return new AgentResponse({
        success: true,
        data: { 
          changed: changes.length,
          settings: changes.map(c => ({ key: c.key, value: c.value }))
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to set multiple settings: ${error.message}`,
        ErrorCodes.STATE_ERROR
      );
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(payload = {}) {
    const { keys } = payload;
    
    try {
      if (keys && Array.isArray(keys)) {
        // Reset specific settings
        for (const key of keys) {
          if (key in this.defaultSettings) {
            const oldValue = this.settings.get(key);
            this.settings.set(key, this.defaultSettings[key]);
            
            await this.broadcast(MessageTypes.SETTINGS_CHANGED, {
              key,
              value: this.defaultSettings[key],
              oldValue
            });
          }
        }
      } else {
        // Reset all settings
        const oldSettings = new Map(this.settings);
        this.settings.clear();
        
        // Set defaults
        for (const [key, value] of Object.entries(this.defaultSettings)) {
          this.settings.set(key, value);
        }
        
        // Broadcast changes
        for (const [key, value] of this.settings) {
          await this.broadcast(MessageTypes.SETTINGS_CHANGED, {
            key,
            value,
            oldValue: oldSettings.get(key)
          });
        }
      }
      
      // Persist changes
      await this.persistSettings();
      
      // Update state
      this.setState({ settings: Object.fromEntries(this.settings) });
      
      return new AgentResponse({
        success: true,
        data: { reset: true }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to reset settings: ${error.message}`,
        ErrorCodes.STATE_ERROR
      );
    }
  }

  /**
   * Export settings
   */
  exportSettings() {
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: Object.fromEntries(this.settings)
    };
    
    return new AgentResponse({
      success: true,
      data: { export: exportData }
    });
  }

  /**
   * Import settings
   */
  async importSettings(payload) {
    const { importData, merge = true } = payload;
    
    if (!importData || !importData.settings) {
      throw new AgentError('Invalid import data', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      const changes = [];
      
      if (!merge) {
        // Clear existing settings
        this.settings.clear();
      }
      
      // Import settings
      for (const [key, value] of Object.entries(importData.settings)) {
        const validationResult = this.validateSetting(key, value);
        if (validationResult.valid) {
          const oldValue = this.settings.get(key);
          this.settings.set(key, value);
          changes.push({ key, value, oldValue });
        }
      }
      
      // Persist changes
      await this.persistSettings();
      
      // Update state
      this.setState({ settings: Object.fromEntries(this.settings) });
      
      // Broadcast changes
      for (const change of changes) {
        await this.broadcast(MessageTypes.SETTINGS_CHANGED, change);
        await this.handleSpecialSetting(change.key, change.value, change.oldValue);
      }
      
      return new AgentResponse({
        success: true,
        data: { 
          imported: changes.length,
          settings: changes.map(c => ({ key: c.key, value: c.value }))
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to import settings: ${error.message}`,
        ErrorCodes.STATE_ERROR
      );
    }
  }

  /**
   * Get preference (alias for getSetting)
   */
  getPreference(payload) {
    return this.getSetting(payload);
  }

  /**
   * Set preference (alias for setSetting)
   */
  async setPreference(payload) {
    return await this.setSetting(payload);
  }

  /**
   * Set theme
   */
  async setTheme(payload) {
    const { theme } = payload;
    const validThemes = ['light', 'dark', 'auto'];
    
    if (!validThemes.includes(theme)) {
      throw new AgentError('Invalid theme value', ErrorCodes.VALIDATION_ERROR);
    }
    
    return await this.setSetting({ key: 'theme', value: theme });
  }

  /**
   * Get theme
   */
  getTheme() {
    return this.getSetting({ key: 'theme' });
  }

  /**
   * Toggle notifications
   */
  async toggleNotifications(payload = {}) {
    const { enabled } = payload;
    const currentValue = this.settings.get('notifications') ?? this.defaultSettings.notifications;
    const newValue = enabled !== undefined ? enabled : !currentValue;
    
    return await this.setSetting({ key: 'notifications', value: newValue });
  }

  /**
   * Load settings from local storage
   */
  async loadSettings() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedSettings = localStorage.getItem('runstr_settings');
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          for (const [key, value] of Object.entries(parsed)) {
            this.settings.set(key, value);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load settings from local storage:', error);
    }
  }

  /**
   * Persist settings to local storage
   */
  async persistSettings() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const settingsObject = Object.fromEntries(this.settings);
        localStorage.setItem('runstr_settings', JSON.stringify(settingsObject));
      }
    } catch (error) {
      console.warn('Failed to persist settings to local storage:', error);
    }
  }

  /**
   * Validate setting value
   */
  validateSetting(key, value) {
    switch (key) {
      case 'distanceUnit':
        return {
          valid: ['km', 'mi'].includes(value),
          error: 'Distance unit must be "km" or "mi"'
        };
        
      case 'activityMode':
        return {
          valid: ['run', 'walk', 'cycle'].includes(value),
          error: 'Activity mode must be "run", "walk", or "cycle"'
        };
        
      case 'publishMode':
        return {
          valid: ['public', 'private', 'mixed'].includes(value),
          error: 'Publish mode must be "public", "private", or "mixed"'
        };
        
      case 'healthEncryptionPref':
        return {
          valid: ['encrypted', 'plaintext'].includes(value),
          error: 'Health encryption preference must be "encrypted" or "plaintext"'
        };
        
      case 'theme':
        return {
          valid: ['light', 'dark', 'auto'].includes(value),
          error: 'Theme must be "light", "dark", or "auto"'
        };
        
      case 'musicVolume':
        return {
          valid: typeof value === 'number' && value >= 0 && value <= 1,
          error: 'Music volume must be a number between 0 and 1'
        };
        
      case 'privateRelayUrl':
        if (value && typeof value === 'string') {
          return {
            valid: value.startsWith('wss://') || value.startsWith('ws://'),
            error: 'Private relay URL must start with wss:// or ws://'
          };
        }
        return { valid: true };
        
      case 'blossomEndpoint':
        if (value && typeof value === 'string') {
          return {
            valid: value.startsWith('https://') || value.startsWith('http://'),
            error: 'Blossom endpoint must be a valid HTTP(S) URL'
          };
        }
        return { valid: true };
        
      default:
        // For boolean settings
        if (typeof this.defaultSettings[key] === 'boolean') {
          return {
            valid: typeof value === 'boolean',
            error: `${key} must be a boolean value`
          };
        }
        
        // For string settings
        if (typeof this.defaultSettings[key] === 'string') {
          return {
            valid: typeof value === 'string',
            error: `${key} must be a string value`
          };
        }
        
        // For number settings
        if (typeof this.defaultSettings[key] === 'number') {
          return {
            valid: typeof value === 'number',
            error: `${key} must be a number value`
          };
        }
        
        // Allow unknown settings
        return { valid: true };
    }
  }

  /**
   * Handle special settings that require additional actions
   */
  async handleSpecialSetting(key, value, oldValue) {
    switch (key) {
      case 'theme':
        // Apply theme to document
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', value);
        }
        break;
        
      case 'notifications':
        // Request notification permission if enabled
        if (value && typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'default') {
            await Notification.requestPermission();
          }
        }
        break;
        
      case 'distanceUnit':
        // Broadcast to other agents that might need to update displays
        await this.broadcast(MessageTypes.PREFERENCE_UPDATED, {
          preference: 'distanceUnit',
          value
        });
        break;
        
      case 'activityMode':
        // Update activity mode in dashboard
        await this.sendMessage('Dashboard', 'activity.setMode', { mode: value });
        break;
        
      case 'blossomEndpoint':
        // Update music agent with new endpoint
        await this.sendMessage('Music', 'settings.blossomEndpoint', { value });
        break;
    }
  }

  /**
   * Handle user login
   */
  async handleUserLogin(message) {
    // Load user-specific settings if available
    // For now, settings are global but this could be extended
    // to support per-user settings stored on Nostr
  }

  /**
   * Handle user logout
   */
  async handleUserLogout(message) {
    // Optionally clear sensitive settings on logout
    const sensitiveSettings = ['privateRelayUrl'];
    
    for (const key of sensitiveSettings) {
      if (this.settings.has(key)) {
        await this.setSetting({ key, value: this.defaultSettings[key] || '' });
      }
    }
  }
}