import { registerPlugin } from '@capacitor/core';
import { EventEmitter } from 'tseep';

// Create a fallback plugin implementation that doesn't crash
const createFallbackPlugin = () => {
  console.warn('Using fallback StepCounter plugin');
  return {
    startTracking: async () => ({ value: 0 }),
    stopTracking: async () => ({ value: 0 }),
    getStepCount: async () => ({ steps: 0 }),
    checkSensors: async () => ({ hasStepCounter: false, hasStepDetector: false }),
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
    this.usingSimulation = false;
    this.sensorInfo = null;
    
    // Try to register listener, but don't crash if it fails
    try {
      // Listen for step updates from the native plugin
      this.listener = StepCounter.addListener('stepUpdate', (data) => {
        try {
          const newSteps = data?.steps || 0;
          if (newSteps !== this.steps) {
            this.steps = newSteps;
            this.usingSimulation = data?.simulated || false;
            this.emit('stepsChange', this.steps, this.usingSimulation);
            console.log(`Step update: ${this.steps}${this.usingSimulation ? ' (simulated)' : ''}`);
          }
        } catch (err) {
          console.error('Error processing step update:', err);
        }
      });
      
      this.listenerRegistered = true;
      console.log('Step counter listener registered successfully');
    } catch (error) {
      console.error('Error adding step counter listener:', error);
      this.isAvailable = false;
    }
    
    // Check sensors on startup
    this.checkSensors();
  }
  
  /**
   * Check if step counter sensors are available
   */
  async checkSensors() {
    try {
      this.sensorInfo = await StepCounter.checkSensors();
      console.log('Step counter sensor check:', this.sensorInfo);
      return this.sensorInfo;
    } catch (error) {
      console.error('Error checking step counter sensors:', error);
      return { hasStepCounter: false, hasStepDetector: false, hasPermission: false };
    }
  }
  
  /**
   * Start tracking steps
   */
  async startTracking() {
    if (this.isTracking) return true;
    
    try {
      // Always force simulation mode to ensure we get step data
      // This will be used only if actual sensors aren't available
      const result = await StepCounter.startTracking({
        useSimulation: true
      });
      
      this.isTracking = true;
      this.usingSimulation = result?.usingSimulation || false;
      
      console.log(`Step counter started: ${this.usingSimulation ? 'using simulation' : 'using real sensors'}`);
      
      // Still set up a polling interval as a fallback/heartbeat
      this.updateInterval = setInterval(async () => {
        if (this.isTracking) {
          try {
            await this.getSteps();
          } catch (e) {
            console.error('Error in step counter polling:', e);
          }
        }
      }, 5000);
      
      // Emit initial step count
      this.emit('stepsChange', this.steps, this.usingSimulation);
      
      return {
        success: true,
        usingSimulation: this.usingSimulation
      };
    } catch (error) {
      console.error('Error starting step counter:', error);
      // Still enter a tracking state and use our own simulation
      this.isTracking = true;
      this.usingSimulation = true;
      this.simulateStepCounter();
      return {
        success: false,
        usingSimulation: true,
        error: error.message
      };
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
    
    console.log(`Step counter stopped. Final count: ${this.steps}`);
    return this.steps;
  }
  
  /**
   * Get current step count
   */
  async getSteps() {
    try {
      const result = await StepCounter.getStepCount();
      const newSteps = result?.steps || this.steps;
      
      if (newSteps !== this.steps) {
        this.steps = newSteps;
        this.isTracking = result?.isTracking || this.isTracking;
        this.usingSimulation = result?.usingSimulation || this.usingSimulation;
        this.emit('stepsChange', this.steps, this.usingSimulation);
      }
      
      return {
        steps: this.steps,
        isTracking: this.isTracking,
        usingSimulation: this.usingSimulation
      };
    } catch (error) {
      console.error('Error getting step count:', error);
      return {
        steps: this.steps,
        isTracking: this.isTracking,
        usingSimulation: this.usingSimulation,
        error: error.message
      };
    }
  }
  
  /**
   * Reset step count
   */
  resetSteps() {
    this.steps = 0;
    this.emit('stepsChange', this.steps, this.usingSimulation);
  }
  
  /**
   * Simulate step counter for devices without sensors
   * or when permissions are denied
   */
  simulateStepCounter() {
    console.log('Using JavaScript-based simulated step counter');
    this.usingSimulation = true;
    
    // Simulate walking at roughly 100-120 steps per minute
    this.updateInterval = setInterval(() => {
      if (this.isTracking) {
        // Random increment between 4-7 steps every 3 seconds
        const increment = Math.floor(Math.random() * 4) + 4;
        this.steps += increment;
        this.emit('stepsChange', this.steps, true);
        console.log(`Simulated step update (JS): ${this.steps} (+${increment})`);
      }
    }, 3000);
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.listener) {
      try {
        this.listener.remove();
      } catch (e) {
        console.error('Error removing step counter listener:', e);
      }
    }
    
    this.isTracking = false;
  }
}

// Create and export a singleton instance
const stepCounterService = new StepCounterService();
export default stepCounterService; 