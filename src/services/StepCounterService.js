import { registerPlugin } from '@capacitor/core';
import { EventEmitter } from 'tseep';

// Register the step counter plugin
const StepCounter = registerPlugin('StepCounter');

class StepCounterService extends EventEmitter {
  constructor() {
    super();
    
    this.steps = 0;
    this.isTracking = false;
    this.updateInterval = null;
    
    // Listen for step updates from the native plugin
    StepCounter.addListener('stepUpdate', (data) => {
      this.steps = data.steps;
      this.emit('stepsChange', this.steps);
    });
  }
  
  /**
   * Start tracking steps
   */
  async startTracking() {
    if (this.isTracking) return;
    
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
      return false;
    }
  }
  
  /**
   * Stop tracking steps
   */
  async stopTracking() {
    if (!this.isTracking) return;
    
    try {
      await StepCounter.stopTracking();
      this.isTracking = false;
      
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      return this.steps;
    } catch (error) {
      console.error('Error stopping step counter:', error);
      return this.steps;
    }
  }
  
  /**
   * Get current step count
   */
  async getSteps() {
    try {
      const result = await StepCounter.getStepCount();
      this.steps = result.steps;
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
}

// Create and export a singleton instance
const stepCounterService = new StepCounterService();
export default stepCounterService; 