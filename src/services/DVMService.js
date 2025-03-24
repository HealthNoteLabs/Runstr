/**
 * DVMService.js
 * Service for interacting with the RUNSTR DVM to fetch and display notes
 */

import { nip19 } from 'nostr-tools';
import dvmConfig from '../config/dvm.config';

class DVMService {
  constructor() {
    // DVM settings from configuration
    this.dvmPubkey = dvmConfig.dvmPubkey;
    this.dvmApiUrl = dvmConfig.apiUrl;
    this.relays = dvmConfig.relays;
    this.connectPromise = null;
    this.subscriptions = new Map();
    this.relayPool = null;
    this.processedEvents = new Set();
  }

  /**
   * Initialize the connection to relays
   */
  async connect() {
    if (!this.connectPromise) {
      this.connectPromise = new Promise((resolve, reject) => {
        try {
          // This is now a regular Promise, not an async Promise executor
          import('nostr-tools').then(({ NostrTools }) => {
            this.relayPool = NostrTools.SimplePool();
            console.log('Connected to relays:', this.relays);
            resolve();
          }).catch(error => {
            console.error('Error importing nostr-tools:', error);
            this.connectPromise = null;
            reject(error);
          });
        } catch (error) {
          console.error('Error connecting to relays:', error);
          this.connectPromise = null;
          reject(error);
        }
      });
    }
    return this.connectPromise;
  }

  /**
   * Get running feed via HTTP API (preferred method)
   * @param {Object} params - Optional parameters for the API request
   * @returns {Promise<Object>} Running feed data
   */
  async getRunningFeed(params = {}) {
    try {
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.since) queryParams.append('since', params.since);
      if (params.until) queryParams.append('until', params.until);
      if (params.include_workouts !== undefined) queryParams.append('include_workouts', params.include_workouts);
      
      const queryString = queryParams.toString();
      const url = `${this.dvmApiUrl}/api/running_feed${queryString ? `?${queryString}` : ''}`;
      
      console.log(`Fetching running feed from: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error('Error fetching running feed:', error);
      throw error;
    }
  }

  /**
   * Parse running information from text
   * @param {string} content - The note content to parse
   * @returns {Promise<Object>} Extracted running data
   */
  async parseRunningNote(content) {
    try {
      const response = await fetch(`${this.dvmApiUrl}/api/running_notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result.extractedData;
    } catch (error) {
      console.error('Error parsing running note:', error);
      throw error;
    }
  }

  /**
   * Send a request to the DVM for workout data via Nostr protocol
   * @param {Object} filter - Filter criteria for notes
   * @returns {Promise<Object>} DVM response
   */
  async requestWorkoutNotes(filter = {}) {
    try {
      await this.connect();
      
      const defaultFilter = { 
        kinds: [101], // NIP-101e workout events
        limit: dvmConfig.defaultLimit,
        since: Math.floor(Date.now() / 1000) - dvmConfig.defaultTimeframe
      };
      
      const combinedFilter = { ...defaultFilter, ...filter };
      
      // Create a NIP-90 request to the DVM
      const requestEvent = {
        kind: 68000, // NIP-90 DVM request
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['p', this.dvmPubkey],
          ['job', 'fetch_workouts'],
          ['param', 'filter', JSON.stringify(combinedFilter)]
        ],
        content: 'Requesting running workout notes'
      };
      
      // Sign the event using window.nostr
      const signedEvent = await window.nostr.signEvent(requestEvent);
      
      // Publish the request (we don't need to use the return value)
      this.relayPool.publish(this.relays, signedEvent);
      
      // Set up a subscription for the response
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.unsubscribe(signedEvent.id);
          reject(new Error('DVM request timed out'));
        }, 30000); // 30 second timeout
        
        const sub = this.relayPool.subscribe(
          this.relays,
          [
            {
              kinds: [68001], // NIP-90 DVM response
              '#e': [signedEvent.id] // Reference to our request
            }
          ],
          {
            onevent: (event) => {
              clearTimeout(timeout);
              this.unsubscribe(signedEvent.id);
              
              // Parse the response
              try {
                const result = JSON.parse(event.content);
                resolve(result);
              } catch {
                reject(new Error('Invalid DVM response format'));
              }
            },
            oneose: () => {
              // Keep the subscription open for the timeout period
            }
          }
        );
        
        this.subscriptions.set(signedEvent.id, sub);
      });
    } catch (error) {
      console.error('Error requesting notes from DVM:', error);
      throw error;
    }
  }
  
  /**
   * Unsubscribe from a specific subscription
   * @param {string} id - Subscription ID
   */
  unsubscribe(id) {
    const sub = this.subscriptions.get(id);
    if (sub) {
      sub.unsub();
      this.subscriptions.delete(id);
    }
  }
  
  /**
   * Close all subscriptions and disconnect
   */
  shutdown() {
    // Close all subscriptions
    for (const sub of this.subscriptions.values()) {
      sub.unsub();
    }
    this.subscriptions.clear();
    
    // Clear connection
    if (this.relayPool) {
      this.relayPool.close(this.relays);
    }
    this.connectPromise = null;
  }
  
  /**
   * Format workout event for display
   * @param {Object} workout - Workout event
   * @returns {Object} Formatted workout data
   */
  formatWorkoutForDisplay(workout) {
    try {
      // Find the workout data from the tags
      const distanceTag = workout.tags.find(tag => tag[0] === 'distance');
      const durationTag = workout.tags.find(tag => tag[0] === 'duration');
      const elevationGainTag = workout.tags.find(tag => tag[0] === 'elevation_gain');
      const dateTag = workout.tags.find(tag => tag[0] === 'started_at');
      
      const distance = distanceTag ? parseFloat(distanceTag[1]) : 0; // in meters
      const duration = durationTag ? parseInt(durationTag[1], 10) : 0; // in seconds
      const elevationGain = elevationGainTag ? parseFloat(elevationGainTag[1]) : 0; // in meters
      const date = dateTag ? new Date(parseInt(dateTag[1], 10) * 1000).toISOString() : new Date(workout.created_at * 1000).toISOString();
      
      // Calculate pace
      const paceInSecondsPerKm = distance > 0 ? (duration / (distance / 1000)) : 0;
      
      return {
        id: workout.id,
        pubkey: workout.pubkey,
        npub: nip19.npubEncode(workout.pubkey),
        distance, // in meters
        duration, // in seconds
        elevationGain, // in meters
        date,
        pace: paceInSecondsPerKm, // in seconds per km
        content: workout.content,
        tags: workout.tags
      };
    } catch (error) {
      console.error('Error formatting workout event:', error);
      return null;
    }
  }
}

// Create a singleton instance
const dvmService = new DVMService();

export default dvmService; 