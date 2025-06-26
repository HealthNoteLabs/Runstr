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
    this.lastValidSpeedTime = null;
    this.speedHistory = [];
    this.isGpsActive = false;
    this.healthCheckInterval = null;
    this.lastStepTime = null;
    
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

  // Update current speed for filtering with improved logic
  updateSpeed(speed, isGpsActive = true) {
    // Mark GPS as active when speed updates are coming in
    this.isGpsActive = isGpsActive;
    this.lastValidSpeedTime = Date.now();
    
    // Only process speed if it's a valid number
    if (typeof speed !== 'number' || isNaN(speed) || speed < 0) {
      console.warn('Invalid speed data received:', speed);
      return;
    }
    
    this.currentSpeed = speed;
    
    // Add to speed history for smoothing (keep last 5 readings)
    this.speedHistory.push({ speed, timestamp: Date.now() });
    if (this.speedHistory.length > 5) {
      this.speedHistory.shift();
    }
    
    // Clear existing timeout
    if (this.speedCheckTimeout) {
      clearTimeout(this.speedCheckTimeout);
    }

    // Only apply vehicle detection if GPS is actively providing data
    if (!this.isGpsActive) {
      return;
    }

    // Calculate smoothed speed from recent readings
    const recentReadings = this.speedHistory.filter(
      reading => Date.now() - reading.timestamp < 10000 // Last 10 seconds
    );
    const smoothedSpeed = recentReadings.length > 0 
      ? recentReadings.reduce((sum, reading) => sum + reading.speed, 0) / recentReadings.length
      : speed;

    // Vehicle detection threshold (adjusted for better accuracy)
    const speedThreshold = 20; // km/h - increased to reduce false positives
    const shouldPause = smoothedSpeed > speedThreshold && recentReadings.length >= 3;

    if (shouldPause && !this.isPausedForSpeed) {
      console.log(`Pausing step counting due to high speed: ${smoothedSpeed.toFixed(1)} km/h (raw: ${speed})`);
      this.isPausedForSpeed = true;
      this.emit('speedPause', { speed: smoothedSpeed, paused: true, reason: 'vehicle_detected' });
    } else if (!shouldPause && this.isPausedForSpeed) {
      // Add a delay before resuming to avoid frequent pause/resume cycles
      this.speedCheckTimeout = setTimeout(() => {
        // Re-check speed is still low
        const currentSmoothedSpeed = this.speedHistory.length > 0
          ? this.speedHistory.reduce((sum, reading) => sum + reading.speed, 0) / this.speedHistory.length
          : 0;
          
        if (currentSmoothedSpeed <= speedThreshold) {
          console.log(`Resuming step counting, speed normalized: ${currentSmoothedSpeed.toFixed(1)} km/h`);
          this.isPausedForSpeed = false;
          this.emit('speedPause', { speed: currentSmoothedSpeed, paused: false, reason: 'speed_normalized' });
        }
      }, 8000); // 8 second delay
    }

    // Auto-resume if no GPS data for extended period (indoor scenario)
    setTimeout(() => {
      if (this.isPausedForSpeed && Date.now() - this.lastValidSpeedTime > 30000) {
        console.log('Auto-resuming step counting: No GPS data for 30+ seconds (likely indoors)');
        this.isPausedForSpeed = false;
        this.isGpsActive = false;
        this.speedHistory = [];
        this.emit('speedPause', { speed: 0, paused: false, reason: 'gps_timeout' });
      }
    }, 35000);
  }

  // Start health monitoring
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Check every minute
  }

  // Stop health monitoring
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // Perform health check on the service
  async performHealthCheck() {
    try {
      // Check if pedometer is still listening
      if (!Pedometer.listening && this.isRunning) {
        console.warn('Health check: Pedometer not listening, attempting restart');
        this.emit('error', new Error('Pedometer service stopped unexpectedly'));
        
        // Attempt to restart
        try {
          await this.restart();
        } catch (restartError) {
          console.error('Failed to restart pedometer:', restartError);
          this.emit('error', restartError);
        }
      }
      
      // Check if we've received steps recently (if user should be moving)
      if (this.lastStepTime && Date.now() - this.lastStepTime > 300000) { // 5 minutes
        console.warn('Health check: No steps received in 5+ minutes');
        // Don't auto-restart here as user might genuinely be stationary
      }
      
      // Check daily reset
      this.checkDailyReset();
      
    } catch (error) {
      console.error('Health check failed:', error);
      this.emit('error', error);
    }
  }

  // Restart the service
  async restart() {
    console.log('Restarting daily step counter service...');
    
    const wasRunning = this.isRunning;
    await this.stop();
    
    if (wasRunning && this.isEnabled()) {
      await this.start();
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
      this.startHealthMonitoring();
      
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

    // Stop health monitoring
    this.stopHealthMonitoring();

    // Note: We don't stop the Pedometer service itself as it might be used by other parts of the app

    this.isRunning = false;
    this.isPausedForSpeed = false;
    this.isGpsActive = false;
    this.speedHistory = [];
    
    console.log('Daily step counter stopped');
    this.emit('stopped', { steps: this.dailySteps });
  }

  // Handle incoming step data from pedometer with validation
  handleStepData(data) {
    // Validate step data
    if (!data || typeof data.count !== 'number' || data.count < 0) {
      console.warn('Invalid step data received:', data);
      return;
    }
    
    // Update last step time for health monitoring
    this.lastStepTime = Date.now();
    
    // For step detector events, increment by 1
    // For step counter events, the count represents total steps since start
    // The Android plugin handles this distinction and sends appropriate count
    this.dailySteps += 1;
    
    // Save to storage
    this.saveDailySteps();

    // Check for milestones
    this.checkMilestones();

    // Emit update
    this.emit('stepsUpdate', { 
      steps: this.dailySteps, 
      goal: this.getDailyGoal(),
      date: this.getTodayKey(),
      lastStepTime: this.lastStepTime
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
          date: this.getTodayKey(),
          id: `${this.getTodayKey()}-${milestone}`
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
      isPausedForSpeed: this.isPausedForSpeed,
      lastStepTime: this.lastStepTime,
      serviceHealth: {
        pedometerListening: Pedometer.listening,
        isGpsActive: this.isGpsActive,
        speedHistoryLength: this.speedHistory.length
      }
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