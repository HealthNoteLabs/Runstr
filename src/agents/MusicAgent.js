import { BaseAgent } from './core/BaseAgent.js';
import { MessageTypes, AgentResponse, ErrorCodes, AgentError } from './core/AgentInterface.js';

/**
 * Music Agent
 * Handles Wavlake integration, music playback, playlist management, and audio features
 */
export class MusicAgent extends BaseAgent {
  constructor(messageBus, options = {}) {
    super('Music', messageBus, {
      version: '1.0.0',
      dependencies: ['CoreServices', 'Settings'],
      ...options
    });
    
    this.currentTrack = null;
    this.playlist = [];
    this.playbackState = 'stopped'; // stopped, playing, paused
    this.volume = 0.8;
    this.repeat = false;
    this.shuffle = false;
    this.blossomEndpoint = '';
    this.audioElement = null;
  }

  async initialize() {
    await super.initialize();
    
    // Set up message handlers
    this.subscribe(MessageTypes.MUSIC_PLAY, this.handleMusicPlay.bind(this));
    this.subscribe(MessageTypes.MUSIC_PAUSE, this.handleMusicPause.bind(this));
    this.subscribe(MessageTypes.SETTINGS_CHANGED, this.handleSettingsChanged.bind(this));
    
    // Load settings
    await this.loadMusicSettings();
    
    // Initialize audio element
    this.initializeAudioElement();
    
    this.setState({
      ready: true,
      currentTrack: null,
      playbackState: 'stopped',
      playlist: [],
      volume: this.volume
    });
  }

  async handleMessage(message) {
    const { type, payload } = message;
    
    try {
      switch (type) {
        case 'music.play':
          return await this.playTrack(payload);
          
        case 'music.pause':
          return this.pausePlayback();
          
        case 'music.resume':
          return this.resumePlayback();
          
        case 'music.stop':
          return this.stopPlayback();
          
        case 'music.next':
          return this.nextTrack();
          
        case 'music.previous':
          return this.previousTrack();
          
        case 'music.setVolume':
          return this.setVolume(payload);
          
        case 'music.search':
          return await this.searchTracks(payload);
          
        case 'music.getTrackInfo':
          return await this.getTrackInfo(payload);
          
        case 'music.getCurrentState':
          return this.getCurrentState();
          
        case 'playlist.add':
          return this.addToPlaylist(payload);
          
        case 'playlist.remove':
          return this.removeFromPlaylist(payload);
          
        case 'playlist.clear':
          return this.clearPlaylist();
          
        case 'playlist.get':
          return this.getPlaylist();
          
        case 'playlist.shuffle':
          return this.toggleShuffle();
          
        case 'playlist.repeat':
          return this.toggleRepeat();
          
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
   * Play a track
   */
  async playTrack(payload) {
    const { track, startPlaylist = false } = payload;
    
    if (!track) {
      throw new AgentError('Track information is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      // Stop current playback
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      }
      
      this.currentTrack = {
        id: track.id || crypto.randomUUID(),
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Unknown Album',
        duration: track.duration || 0,
        url: track.url || '',
        artwork: track.artwork || '',
        source: track.source || 'wavlake'
      };
      
      // Set audio source
      if (this.audioElement && this.currentTrack.url) {
        this.audioElement.src = this.currentTrack.url;
        
        // Set up event listeners
        this.setupAudioEventListeners();
        
        // Start playback
        try {
          await this.audioElement.play();
          this.playbackState = 'playing';
        } catch (error) {
          throw new AgentError(`Failed to play audio: ${error.message}`, ErrorCodes.COMMUNICATION_ERROR);
        }
      }
      
      // Add to playlist if requested
      if (startPlaylist && !this.playlist.find(t => t.id === this.currentTrack.id)) {
        this.playlist.unshift(this.currentTrack);
      }
      
      this.setState({
        currentTrack: this.currentTrack,
        playbackState: this.playbackState,
        playlist: this.playlist
      });
      
      // Broadcast track change
      await this.broadcast(MessageTypes.MUSIC_TRACK_CHANGED, {
        track: this.currentTrack,
        playbackState: this.playbackState
      });
      
      return new AgentResponse({
        success: true,
        data: {
          playing: true,
          track: this.currentTrack
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to play track: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Pause playback
   */
  pausePlayback() {
    if (this.audioElement && this.playbackState === 'playing') {
      this.audioElement.pause();
      this.playbackState = 'paused';
      
      this.setState({ playbackState: this.playbackState });
      
      return new AgentResponse({
        success: true,
        data: { paused: true }
      });
    }
    
    return new AgentResponse({
      success: false,
      error: 'No track is currently playing'
    });
  }

  /**
   * Resume playback
   */
  resumePlayback() {
    if (this.audioElement && this.playbackState === 'paused') {
      this.audioElement.play();
      this.playbackState = 'playing';
      
      this.setState({ playbackState: this.playbackState });
      
      return new AgentResponse({
        success: true,
        data: { resumed: true }
      });
    }
    
    return new AgentResponse({
      success: false,
      error: 'No track is currently paused'
    });
  }

  /**
   * Stop playback
   */
  stopPlayback() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    
    this.playbackState = 'stopped';
    this.currentTrack = null;
    
    this.setState({
      playbackState: this.playbackState,
      currentTrack: null
    });
    
    return new AgentResponse({
      success: true,
      data: { stopped: true }
    });
  }

  /**
   * Next track
   */
  nextTrack() {
    if (this.playlist.length === 0) {
      return new AgentResponse({
        success: false,
        error: 'Playlist is empty'
      });
    }
    
    let nextIndex = 0;
    
    if (this.currentTrack) {
      const currentIndex = this.playlist.findIndex(t => t.id === this.currentTrack.id);
      if (currentIndex >= 0) {
        nextIndex = this.shuffle 
          ? Math.floor(Math.random() * this.playlist.length)
          : (currentIndex + 1) % this.playlist.length;
      }
    }
    
    const nextTrack = this.playlist[nextIndex];
    return this.playTrack({ track: nextTrack });
  }

  /**
   * Previous track
   */
  previousTrack() {
    if (this.playlist.length === 0) {
      return new AgentResponse({
        success: false,
        error: 'Playlist is empty'
      });
    }
    
    let prevIndex = this.playlist.length - 1;
    
    if (this.currentTrack) {
      const currentIndex = this.playlist.findIndex(t => t.id === this.currentTrack.id);
      if (currentIndex >= 0) {
        prevIndex = this.shuffle 
          ? Math.floor(Math.random() * this.playlist.length)
          : (currentIndex - 1 + this.playlist.length) % this.playlist.length;
      }
    }
    
    const prevTrack = this.playlist[prevIndex];
    return this.playTrack({ track: prevTrack });
  }

  /**
   * Set volume
   */
  setVolume(payload) {
    const { volume } = payload;
    
    if (typeof volume !== 'number' || volume < 0 || volume > 1) {
      throw new AgentError('Volume must be a number between 0 and 1', ErrorCodes.VALIDATION_ERROR);
    }
    
    this.volume = volume;
    
    if (this.audioElement) {
      this.audioElement.volume = volume;
    }
    
    this.setState({ volume });
    
    return new AgentResponse({
      success: true,
      data: { volume }
    });
  }

  /**
   * Search tracks
   */
  async searchTracks(payload) {
    const { query, limit = 20, offset = 0 } = payload;
    
    if (!query || query.trim().length === 0) {
      throw new AgentError('Search query is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      // Use Blossom endpoint to search for music
      const searchUrl = this.blossomEndpoint ? 
        `${this.blossomEndpoint}/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}` :
        null;
      
      if (!searchUrl) {
        throw new AgentError('No music server configured', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      // Fetch search results
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new AgentError('Search request failed', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      const results = await response.json();
      
      // Format results
      const tracks = (results.tracks || []).map(track => ({
        id: track.id || crypto.randomUUID(),
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Unknown Album',
        duration: track.duration || 0,
        url: track.url || track.stream_url || '',
        artwork: track.artwork || track.cover_url || '',
        source: 'wavlake'
      }));
      
      return new AgentResponse({
        success: true,
        data: {
          tracks,
          query,
          total: results.total || tracks.length,
          hasMore: results.hasMore || false
        }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to search tracks: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get track info
   */
  async getTrackInfo(payload) {
    const { trackId } = payload;
    
    if (!trackId) {
      throw new AgentError('Track ID is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    try {
      // Fetch track info from Blossom endpoint
      const infoUrl = this.blossomEndpoint ? 
        `${this.blossomEndpoint}/track/${encodeURIComponent(trackId)}` :
        null;
      
      if (!infoUrl) {
        throw new AgentError('No music server configured', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      const response = await fetch(infoUrl);
      
      if (!response.ok) {
        throw new AgentError('Failed to fetch track info', ErrorCodes.COMMUNICATION_ERROR);
      }
      
      const trackData = await response.json();
      
      const track = {
        id: trackData.id || trackId,
        title: trackData.title || 'Unknown Title',
        artist: trackData.artist || 'Unknown Artist',
        album: trackData.album || 'Unknown Album',
        duration: trackData.duration || 0,
        url: trackData.url || trackData.stream_url || '',
        artwork: trackData.artwork || trackData.cover_url || '',
        description: trackData.description || '',
        genre: trackData.genre || '',
        year: trackData.year || null,
        source: 'wavlake'
      };
      
      return new AgentResponse({
        success: true,
        data: { track }
      });
      
    } catch (error) {
      throw new AgentError(
        `Failed to get track info: ${error.message}`,
        ErrorCodes.COMMUNICATION_ERROR
      );
    }
  }

  /**
   * Get current playback state
   */
  getCurrentState() {
    return new AgentResponse({
      success: true,
      data: {
        currentTrack: this.currentTrack,
        playbackState: this.playbackState,
        volume: this.volume,
        repeat: this.repeat,
        shuffle: this.shuffle,
        playlist: this.playlist,
        currentTime: this.audioElement ? this.audioElement.currentTime : 0,
        duration: this.audioElement ? this.audioElement.duration : 0
      }
    });
  }

  /**
   * Add track to playlist
   */
  addToPlaylist(payload) {
    const { track } = payload;
    
    if (!track) {
      throw new AgentError('Track is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    // Check if track already exists
    if (this.playlist.find(t => t.id === track.id)) {
      return new AgentResponse({
        success: false,
        error: 'Track already in playlist'
      });
    }
    
    this.playlist.push(track);
    this.setState({ playlist: this.playlist });
    
    return new AgentResponse({
      success: true,
      data: {
        added: true,
        track,
        playlistLength: this.playlist.length
      }
    });
  }

  /**
   * Remove track from playlist
   */
  removeFromPlaylist(payload) {
    const { trackId } = payload;
    
    if (!trackId) {
      throw new AgentError('Track ID is required', ErrorCodes.VALIDATION_ERROR);
    }
    
    const initialLength = this.playlist.length;
    this.playlist = this.playlist.filter(t => t.id !== trackId);
    
    if (this.playlist.length === initialLength) {
      return new AgentResponse({
        success: false,
        error: 'Track not found in playlist'
      });
    }
    
    this.setState({ playlist: this.playlist });
    
    return new AgentResponse({
      success: true,
      data: {
        removed: true,
        trackId,
        playlistLength: this.playlist.length
      }
    });
  }

  /**
   * Clear playlist
   */
  clearPlaylist() {
    this.playlist = [];
    this.setState({ playlist: this.playlist });
    
    return new AgentResponse({
      success: true,
      data: { cleared: true }
    });
  }

  /**
   * Get playlist
   */
  getPlaylist() {
    return new AgentResponse({
      success: true,
      data: { playlist: this.playlist }
    });
  }

  /**
   * Toggle shuffle
   */
  toggleShuffle() {
    this.shuffle = !this.shuffle;
    this.setState({ shuffle: this.shuffle });
    
    return new AgentResponse({
      success: true,
      data: { shuffle: this.shuffle }
    });
  }

  /**
   * Toggle repeat
   */
  toggleRepeat() {
    this.repeat = !this.repeat;
    this.setState({ repeat: this.repeat });
    
    return new AgentResponse({
      success: true,
      data: { repeat: this.repeat }
    });
  }

  /**
   * Initialize audio element
   */
  initializeAudioElement() {
    if (typeof window !== 'undefined' && window.Audio) {
      this.audioElement = new Audio();
      this.audioElement.volume = this.volume;
      this.setupAudioEventListeners();
    }
  }

  /**
   * Setup audio event listeners
   */
  setupAudioEventListeners() {
    if (!this.audioElement) return;
    
    // Track ended
    this.audioElement.onended = () => {
      if (this.repeat) {
        this.audioElement.currentTime = 0;
        this.audioElement.play();
      } else if (this.playlist.length > 1) {
        this.nextTrack();
      } else {
        this.playbackState = 'stopped';
        this.setState({ playbackState: this.playbackState });
      }
    };
    
    // Error handling
    this.audioElement.onerror = (error) => {
      console.error('Audio playback error:', error);
      this.playbackState = 'stopped';
      this.setState({ playbackState: this.playbackState });
    };
    
    // Time update
    this.audioElement.ontimeupdate = () => {
      this.setState({
        currentTime: this.audioElement.currentTime,
        duration: this.audioElement.duration
      });
    };
    
    // Loading states
    this.audioElement.onloadstart = () => {
      this.setState({ loading: true });
    };
    
    this.audioElement.oncanplay = () => {
      this.setState({ loading: false });
    };
  }

  /**
   * Load music settings
   */
  async loadMusicSettings() {
    try {
      const settingsResponse = await this.sendMessage('Settings', 'settings.get', {
        key: 'blossomEndpoint'
      });
      
      if (settingsResponse.success) {
        this.blossomEndpoint = settingsResponse.data.value || '';
      }
    } catch (error) {
      console.warn('Failed to load music settings:', error);
    }
  }

  /**
   * Handle music play event
   */
  async handleMusicPlay(message) {
    const { payload } = message;
    await this.playTrack(payload);
  }

  /**
   * Handle music pause event
   */
  async handleMusicPause(message) {
    this.pausePlayback();
  }

  /**
   * Handle settings changed
   */
  async handleSettingsChanged(message) {
    const { payload } = message;
    
    if (payload.key === 'blossomEndpoint') {
      this.blossomEndpoint = payload.value || '';
    }
  }

  /**
   * Cleanup when agent is destroyed
   */
  async destroy() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
    
    await super.destroy();
  }
}