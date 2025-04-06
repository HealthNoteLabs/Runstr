import { registerPlugin } from '@capacitor/core';
import { EventEmitter } from 'tseep';

// Create a fallback plugin implementation that doesn't crash
const createFallbackPlugin = () => {
  console.warn('Using fallback StepCounter plugin');
  return {
    startTracking: async () => ({ value: 0 }),
    stopTracking: async () => ({ value: 0 }),
    getStepCount: async () => ({ steps: 0 }),
    addListener: () => ({ remove: () => {} })
  };
};

// Register the step counter plugin with error handling
let StepCounter;
try {
  StepCounter = registerPlugin('StepCounter');
} catch (error) {
  console.error('Failed to register StepCounter plugin:', error);
  StepCounter = createFallbackPlugin();
}

class StepCounterService extends EventEmitter {
  constructor() {
    super();
    
    this.steps = 0;
    this.isTracking = false;
    this.updateInterval = null;
    this.listenerRegistered = false;
    this.isAvailable = true;
    
    // Try to register listener, but don't crash if it fails
    try {
      // Listen for step updates from the native plugin
      StepCounter.addListener('stepUpdate', (data) => {
        this.steps = data?.steps || 0;
        this.emit('stepsChange', this.steps);
      });
      this.listenerRegistered = true;
    } catch (error) {
      console.error('Error adding step counter listener:', error);
      this.isAvailable = false;
    }
  }
  
  /**
   * Start tracking steps
   */
  async startTracking() {
    if (this.isTracking) return true;
    
    try {
      await StepCounter.startTracking();
      this.isTracking = true;
      
      // Set up a polling interval as a fallback for devices that don't send regular updates
      this.updateInterval = setInterval(async () => {
        if (this.isTracking) {
          await this.getSteps();
        }
      }, 3000);
      
      return true;
    } catch (error) {
      console.error('Error starting step counter:', error);
      // Simulate steps with timer in case of failure
      this.simulateStepCounter();
      return false;
    }
  }
  
  /**
   * Stop tracking steps
   */
  async stopTracking() {
    if (!this.isTracking) return this.steps;
    
    try {
      await StepCounter.stopTracking();
    } catch (error) {
      console.error('Error stopping step counter:', error);
    }
    
    this.isTracking = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    return this.steps;
  }
  
  /**
   * Get current step count
   */
  async getSteps() {
    try {
      const result = await StepCounter.getStepCount();
      this.steps = result?.steps || this.steps;
      this.emit('stepsChange', this.steps);
      return this.steps;
    } catch (error) {
      console.error('Error getting step count:', error);
      return this.steps;
    }
  }
  
  /**
   * Reset step count
   */
  resetSteps() {
    this.steps = 0;
    this.emit('stepsChange', this.steps);
  }
  
  /**
   * Simulate step counter for devices without sensors
   * or when permissions are denied
   */
  simulateStepCounter() {
    console.log('Using simulated step counter');
    // Simulate walking at roughly 100-120 steps per minute
    this.updateInterval = setInterval(() => {
      // Random increment between 4-7 steps every 3 seconds
      const increment = Math.floor(Math.random() * 4) + 4;
      this.steps += increment;
      this.emit('stepsChange', this.steps);
    }, 3000);
    
    this.isTracking = true;
  }
}

// Create and export a singleton instance
const stepCounterService = new StepCounterService();
export default stepCounterService; 