import { EventEmitter } from 'events';
import { Pedometer } from './PedometerService';

class DailyStepCounterService extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.dailySteps = 0;
    this.lastResetDate = null;
    this.pedometerUnsubscribe = null;
    this.currentSpeed = 0;
    this.speedCheckTimeout = null;
    this.isPausedForSpeed = false;
    
    // Initialize from storage
    this.loadDailySteps();
    
    // Check for daily reset on startup
    this.checkDailyReset();
  }

  // Get today's date string for storage keys
  getTodayKey() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  // Load daily steps from localStorage
  loadDailySteps() {
    const todayKey = this.getTodayKey();
    const storedSteps = localStorage.getItem(`dailySteps_${todayKey}`);
    const storedResetDate = localStorage.getItem('dailyStepsLastReset');
    
    this.dailySteps = storedSteps ? parseInt(storedSteps, 10) : 0;
    this.lastResetDate = storedResetDate || todayKey;
    
    console.log(`Loaded daily steps: ${this.dailySteps} for ${todayKey}`);
  }

  // Save daily steps to localStorage
  saveDailySteps() {
    const todayKey = this.getTodayKey();
    localStorage.setItem(`dailySteps_${todayKey}`, this.dailySteps.toString());
    localStorage.setItem('dailyStepsLastReset', todayKey);
  }

  // Check if we need to reset for a new day
  checkDailyReset() {
    const todayKey = this.getTodayKey();
    if (this.lastResetDate !== todayKey) {
      console.log(`Daily reset: ${this.lastResetDate} -> ${todayKey}`);
      this.dailySteps = 0;
      this.lastResetDate = todayKey;
      this.saveDailySteps();
      this.emit('dailyReset', { date: todayKey, steps: 0 });
    }
  }

  // Check if settings allow daily step counting
  isEnabled() {
    return localStorage.getItem('alwaysOnStepCounter') === 'true' && 
           localStorage.getItem('usePedometer') === 'true';
  }

  // Get daily step goal from settings
  getDailyGoal() {
    const stored = localStorage.getItem('dailyStepGoal');
    return stored ? parseInt(stored, 10) : 10000;
  }

  // Update current speed for filtering
  updateSpeed(speed) {
    this.currentSpeed = speed;
    
    // Clear existing timeout
    if (this.speedCheckTimeout) {
      clearTimeout(this.speedCheckTimeout);
    }

    // Check if we should pause counting due to high speed (vehicle movement)
    const speedThreshold = 15; // km/h
    const shouldPause = speed > speedThreshold;

    if (shouldPause && !this.isPausedForSpeed) {
      console.log(`Pausing step counting due to high speed: ${speed} km/h`);
      this.isPausedForSpeed = true;
      this.emit('speedPause', { speed, paused: true });
    } else if (!shouldPause && this.isPausedForSpeed) {
      // Add a delay before resuming to avoid frequent pause/resume cycles
      this.speedCheckTimeout = setTimeout(() => {
        if (this.currentSpeed <= speedThreshold) {
          console.log(`Resuming step counting, speed normalized: ${this.currentSpeed} km/h`);
          this.isPausedForSpeed = false;
          this.emit('speedPause', { speed: this.currentSpeed, paused: false });
        }
      }, 5000); // 5 second delay
    }
  }

  // Start daily step counting
  async start() {
    if (!this.isEnabled()) {
      console.log('Daily step counter not enabled in settings');
      return false;
    }

    if (this.isRunning) {
      console.log('Daily step counter already running');
      return true;
    }

    try {
      // Check for daily reset before starting
      this.checkDailyReset();

      // Start the pedometer if not already listening
      if (!Pedometer.listening && Pedometer.supported) {
        await Pedometer.start();
      }

      // Subscribe to step events
      this.pedometerUnsubscribe = Pedometer.addListener((data) => {
        if (!this.isPausedForSpeed) {
          this.handleStepData(data);
        }
      });

      this.isRunning = true;
      console.log('Daily step counter started');
      this.emit('started', { steps: this.dailySteps });
      return true;
    } catch (error) {
      console.error('Failed to start daily step counter:', error);
      this.emit('error', error);
      return false;
    }
  }

  // Stop daily step counting
  async stop() {
    if (!this.isRunning) {
      return;
    }

    // Unsubscribe from pedometer events
    if (this.pedometerUnsubscribe) {
      this.pedometerUnsubscribe();
      this.pedometerUnsubscribe = null;
    }

    // Clear speed check timeout
    if (this.speedCheckTimeout) {
      clearTimeout(this.speedCheckTimeout);
      this.speedCheckTimeout = null;
    }

    // Note: We don't stop the Pedometer service itself as it might be used by other parts of the app

    this.isRunning = false;
    this.isPausedForSpeed = false;
    console.log('Daily step counter stopped');
    this.emit('stopped', { steps: this.dailySteps });
  }

  // Handle incoming step data from pedometer
  handleStepData(data) {
    const newSteps = data.count || 0;
    
    // Simple increment approach - count each step event
    this.dailySteps += 1;
    
    // Save to storage
    this.saveDailySteps();

    // Check for milestones
    this.checkMilestones();

    // Emit update
    this.emit('stepsUpdate', { 
      steps: this.dailySteps, 
      goal: this.getDailyGoal(),
      date: this.getTodayKey()
    });
  }

  // Check for milestone achievements
  checkMilestones() {
    const goal = this.getDailyGoal();
    const milestones = [1000, 5000, goal, 15000, 20000];
    
    milestones.forEach(milestone => {
      const previousSteps = this.dailySteps - 1;
      if (previousSteps < milestone && this.dailySteps >= milestone) {
        console.log(`Daily step milestone reached: ${milestone}`);
        this.emit('milestone', { 
          milestone, 
          steps: this.dailySteps, 
          goal,
          date: this.getTodayKey()
        });
      }
    });
  }

  // Get current daily step data
  getDailySteps() {
    this.checkDailyReset(); // Ensure we have current data
    return {
      steps: this.dailySteps,
      goal: this.getDailyGoal(),
      progress: Math.min((this.dailySteps / this.getDailyGoal()) * 100, 100),
      date: this.getTodayKey(),
      isRunning: this.isRunning,
      isPausedForSpeed: this.isPausedForSpeed
    };
  }

  // Get step data for a specific date
  getStepsForDate(dateString) {
    const storedSteps = localStorage.getItem(`dailySteps_${dateString}`);
    return storedSteps ? parseInt(storedSteps, 10) : 0;
  }

  // Get step history for the last N days
  getStepHistory(days = 7) {
    const history = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const steps = this.getStepsForDate(dateString);
      
      history.push({
        date: dateString,
        steps,
        goal: this.getDailyGoal() // Note: assumes goal hasn't changed
      });
    }
    
    return history.reverse(); // Oldest first
  }

  // Clean up old step data (keep last 30 days)
  cleanupOldData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffString = cutoffDate.toISOString().split('T')[0];
    
    // Get all localStorage keys that match our pattern
    const keysToCheck = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('dailySteps_')) {
        keysToCheck.push(key);
      }
    }
    
    // Remove old entries
    keysToCheck.forEach(key => {
      const dateString = key.replace('dailySteps_', '');
      if (dateString < cutoffString) {
        localStorage.removeItem(key);
        console.log(`Cleaned up old step data: ${dateString}`);
      }
    });
  }
}

// Create singleton instance
export const dailyStepCounter = new DailyStepCounterService();
export default dailyStepCounter; 