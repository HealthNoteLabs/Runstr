import { useState, useEffect } from 'react';
import { convertDistance } from '../utils/formatters';

export const Goals = () => {
  // Goal state
  const [goals, setGoals] = useState(() => {
    const savedGoals = localStorage.getItem('runningGoals');
    return savedGoals ? JSON.parse(savedGoals) : {
      weekly: { 
        active: false, 
        target: 10, 
        unit: localStorage.getItem('distanceUnit') || 'km',
        progress: 0
      },
      monthly: { 
        active: false, 
        target: 40, 
        unit: localStorage.getItem('distanceUnit') || 'km',
        progress: 0
      },
      yearly: { 
        active: false, 
        target: 500, 
        unit: localStorage.getItem('distanceUnit') || 'km',
        progress: 0
      }
    };
  });
  
  const [editingGoal, setEditingGoal] = useState(null);
  const [showingDetails, setShowingDetails] = useState(null);
  const [progressHistory, setProgressHistory] = useState(() => {
    const savedHistory = localStorage.getItem('goalProgressHistory');
    return savedHistory ? JSON.parse(savedHistory) : {
      weekly: [],
      monthly: [],
      yearly: []
    };
  });
  
  // Load run history to calculate progress
  useEffect(() => {
    loadRunHistory();
    
    // Set up periodic refresh for weekly/monthly/yearly calculations
    const interval = setInterval(() => {
      loadRunHistory();
    }, 3600000); // Refresh every hour
    
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Update localStorage when goals change
  useEffect(() => {
    localStorage.setItem('runningGoals', JSON.stringify(goals));
  }, [goals]);
  
  // Update localStorage when progress history changes
  useEffect(() => {
    localStorage.setItem('goalProgressHistory', JSON.stringify(progressHistory));
  }, [progressHistory]);
  
  const loadRunHistory = () => {
    try {
      const storedHistory = localStorage.getItem('runHistory');
      if (!storedHistory) return;
      
      const runHistory = JSON.parse(storedHistory);
      
      // Skip calculations if no runs
      if (!runHistory || runHistory.length === 0) {
        setGoals(prevGoals => ({
          weekly: { ...prevGoals.weekly, progress: 0 },
          monthly: { ...prevGoals.monthly, progress: 0 },
          yearly: { ...prevGoals.yearly, progress: 0 }
        }));
        return;
      }
      
      // Calculate current period boundaries
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      startOfYear.setHours(0, 0, 0, 0);
      
      // Calculate progress for each time period
      let weeklyDistance = 0;
      let monthlyDistance = 0;
      let yearlyDistance = 0;
      
      // Create a Map to detect duplicates by date and distance
      const processedRuns = new Map();
      
      runHistory.forEach(run => {
        // Skip invalid runs
        if (!run.date || isNaN(run.distance) || run.distance <= 0) {
          return;
        }
        
        // Create a signature for the run to detect potential duplicates
        const runDate = new Date(run.date);
        const dateStr = runDate.toDateString();
        const runSignature = `${dateStr}-${run.distance.toFixed(1)}`;
        
        // Skip if we've already counted a run with this signature
        if (processedRuns.has(runSignature)) {
          return;
        }
        
        // Mark this run as processed
        processedRuns.set(runSignature, true);
        
        const runDistance = parseFloat(run.distance);
        
        if (runDate >= startOfWeek) {
          weeklyDistance += runDistance;
        }
        
        if (runDate >= startOfMonth) {
          monthlyDistance += runDistance;
        }
        
        if (runDate >= startOfYear) {
          yearlyDistance += runDistance;
        }
      });
      
      // Update progress in state
      setGoals(prevGoals => ({
        weekly: { ...prevGoals.weekly, progress: weeklyDistance },
        monthly: { ...prevGoals.monthly, progress: monthlyDistance },
        yearly: { ...prevGoals.yearly, progress: yearlyDistance }
      }));
      
      // Update history
      updateProgressHistory(weeklyDistance, monthlyDistance, yearlyDistance);
      
    } catch (error) {
      console.error('Error loading run history:', error);
    }
  };
  
  const updateProgressHistory = (weeklyDistance, monthlyDistance, yearlyDistance) => {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const monthName = now.toLocaleString('default', { month: 'short' });
    const year = now.getFullYear();
    
    setProgressHistory(prev => {
      // Update weekly history
      const existingWeekIndex = prev.weekly.findIndex(item => 
        item.weekNumber === weekNumber && item.year === year
      );
      
      const updatedWeekly = [...prev.weekly];
      if (existingWeekIndex >= 0) {
        updatedWeekly[existingWeekIndex] = { 
          weekNumber, 
          year, 
          distance: weeklyDistance 
        };
      } else {
        updatedWeekly.push({ weekNumber, year, distance: weeklyDistance });
      }
      
      // Update monthly history
      const existingMonthIndex = prev.monthly.findIndex(item => 
        item.month === monthName && item.year === year
      );
      
      const updatedMonthly = [...prev.monthly];
      if (existingMonthIndex >= 0) {
        updatedMonthly[existingMonthIndex] = { 
          month: monthName, 
          year, 
          distance: monthlyDistance 
        };
      } else {
        updatedMonthly.push({ month: monthName, year, distance: monthlyDistance });
      }
      
      // Update yearly history
      const existingYearIndex = prev.yearly.findIndex(item => 
        item.year === year
      );
      
      const updatedYearly = [...prev.yearly];
      if (existingYearIndex >= 0) {
        updatedYearly[existingYearIndex] = { 
          year, 
          distance: yearlyDistance 
        };
      } else {
        updatedYearly.push({ year, distance: yearlyDistance });
      }
      
      return {
        weekly: updatedWeekly,
        monthly: updatedMonthly,
        yearly: updatedYearly
      };
    });
  };
  
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };
  
  const handleGoalToggle = (period) => {
    setGoals(prevGoals => ({
      ...prevGoals,
      [period]: {
        ...prevGoals[period],
        active: !prevGoals[period].active
      }
    }));
  };
  
  const handleEditGoal = (period) => {
    setEditingGoal(period);
  };
  
  const handleSaveGoal = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const target = parseFloat(formData.get('target'));
    const unit = formData.get('unit');
    
    if (target > 0) {
      setGoals(prevGoals => ({
        ...prevGoals,
        [editingGoal]: {
          ...prevGoals[editingGoal],
          target,
          unit
        }
      }));
    }
    
    setEditingGoal(null);
  };
  
  const handleCancelEdit = () => {
    setEditingGoal(null);
  };
  
  const getProgressPercentage = (goal) => {
    if (goal.target === 0) return 0;
    // Ensure we're working with numbers for the calculation
    const progress = Number(goal.progress);
    const target = Number(goal.target);
    return Math.min(100, (progress / target) * 100);
  };
  
  const toggleDetails = (period) => {
    setShowingDetails(showingDetails === period ? null : period);
  };
  
  const formatProgress = (goal) => {
    const progressValue = convertDistance(goal.progress, goal.unit);
    const targetValue = goal.target;
    return `${progressValue} / ${targetValue} ${goal.unit}`;
  };
  
  const getStatusClass = (goal) => {
    const percentage = getProgressPercentage(goal);
    if (percentage >= 100) return 'complete';
    if (percentage >= 75) return 'almost';
    if (percentage >= 50) return 'halfway';
    return 'starting';
  };
  
  return (
    <div className="goals-container">
      <h2 className="page-title">RUNNING GOALS</h2>
      
      <div className="goals-wrapper">
        {/* Weekly Goal */}
        <div className={`goal-card ${goals.weekly.active ? 'active' : 'inactive'} ${getStatusClass(goals.weekly)}`}>
          <div className="goal-header">
            <h3>Weekly Goal</h3>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={goals.weekly.active}
                onChange={() => handleGoalToggle('weekly')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          
          {editingGoal === 'weekly' ? (
            <form onSubmit={handleSaveGoal} className="goal-form">
              <div className="form-group">
                <label htmlFor="target">Distance Target:</label>
                <div className="input-unit-group">
                  <input
                    type="number"
                    id="target"
                    name="target"
                    min="0.1"
                    step="0.1"
                    defaultValue={goals.weekly.target}
                    required
                  />
                  <select 
                    name="unit" 
                    defaultValue={goals.weekly.unit}
                  >
                    <option value="km">km</option>
                    <option value="mi">mi</option>
                  </select>
                </div>
              </div>
              <div className="form-buttons">
                <button type="submit" className="save-button">Save</button>
                <button type="button" className="cancel-button" onClick={handleCancelEdit}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="goal-content">
              <div className="goal-target">
                <span>Target: {goals.weekly.target} {goals.weekly.unit}</span>
                <button className="edit-button" onClick={() => handleEditGoal('weekly')}>
                  Edit
                </button>
              </div>
              
              <div className="goal-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${getProgressPercentage(goals.weekly)}%` }}
                  ></div>
                </div>
                <div className="progress-stats">
                  <span>{formatProgress(goals.weekly)}</span>
                  <span>{getProgressPercentage(goals.weekly).toFixed(0)}%</span>
                </div>
              </div>
              
              <button 
                className="details-button" 
                onClick={() => toggleDetails('weekly')}
              >
                {showingDetails === 'weekly' ? 'Hide Details' : 'Show Details'}
              </button>
              
              {showingDetails === 'weekly' && (
                <div className="goal-details">
                  <h4>Progress History</h4>
                  <div className="history-list">
                    {progressHistory.weekly.slice(-5).map((week, index) => (
                      <div key={index} className="history-item">
                        <span>Week {week.weekNumber}, {week.year}</span>
                        <span>{convertDistance(week.distance, goals.weekly.unit)} {goals.weekly.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Monthly Goal */}
        <div className={`goal-card ${goals.monthly.active ? 'active' : 'inactive'} ${getStatusClass(goals.monthly)}`}>
          <div className="goal-header">
            <h3>Monthly Goal</h3>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={goals.monthly.active}
                onChange={() => handleGoalToggle('monthly')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          
          {editingGoal === 'monthly' ? (
            <form onSubmit={handleSaveGoal} className="goal-form">
              <div className="form-group">
                <label htmlFor="target">Distance Target:</label>
                <div className="input-unit-group">
                  <input
                    type="number"
                    id="target"
                    name="target"
                    min="0.1"
                    step="0.1"
                    defaultValue={goals.monthly.target}
                    required
                  />
                  <select 
                    name="unit" 
                    defaultValue={goals.monthly.unit}
                  >
                    <option value="km">km</option>
                    <option value="mi">mi</option>
                  </select>
                </div>
              </div>
              <div className="form-buttons">
                <button type="submit" className="save-button">Save</button>
                <button type="button" className="cancel-button" onClick={handleCancelEdit}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="goal-content">
              <div className="goal-target">
                <span>Target: {goals.monthly.target} {goals.monthly.unit}</span>
                <button className="edit-button" onClick={() => handleEditGoal('monthly')}>
                  Edit
                </button>
              </div>
              
              <div className="goal-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${getProgressPercentage(goals.monthly)}%` }}
                  ></div>
                </div>
                <div className="progress-stats">
                  <span>{formatProgress(goals.monthly)}</span>
                  <span>{getProgressPercentage(goals.monthly).toFixed(0)}%</span>
                </div>
              </div>
              
              <button 
                className="details-button" 
                onClick={() => toggleDetails('monthly')}
              >
                {showingDetails === 'monthly' ? 'Hide Details' : 'Show Details'}
              </button>
              
              {showingDetails === 'monthly' && (
                <div className="goal-details">
                  <h4>Progress History</h4>
                  <div className="history-list">
                    {progressHistory.monthly.slice(-5).map((month, index) => (
                      <div key={index} className="history-item">
                        <span>{month.month} {month.year}</span>
                        <span>{convertDistance(month.distance, goals.monthly.unit)} {goals.monthly.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Yearly Goal */}
        <div className={`goal-card ${goals.yearly.active ? 'active' : 'inactive'} ${getStatusClass(goals.yearly)}`}>
          <div className="goal-header">
            <h3>Yearly Goal</h3>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={goals.yearly.active}
                onChange={() => handleGoalToggle('yearly')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          
          {editingGoal === 'yearly' ? (
            <form onSubmit={handleSaveGoal} className="goal-form">
              <div className="form-group">
                <label htmlFor="target">Distance Target:</label>
                <div className="input-unit-group">
                  <input
                    type="number"
                    id="target"
                    name="target"
                    min="0.1"
                    step="0.1"
                    defaultValue={goals.yearly.target}
                    required
                  />
                  <select 
                    name="unit" 
                    defaultValue={goals.yearly.unit}
                  >
                    <option value="km">km</option>
                    <option value="mi">mi</option>
                  </select>
                </div>
              </div>
              <div className="form-buttons">
                <button type="submit" className="save-button">Save</button>
                <button type="button" className="cancel-button" onClick={handleCancelEdit}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className="goal-content">
              <div className="goal-target">
                <span>Target: {goals.yearly.target} {goals.yearly.unit}</span>
                <button className="edit-button" onClick={() => handleEditGoal('yearly')}>
                  Edit
                </button>
              </div>
              
              <div className="goal-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${getProgressPercentage(goals.yearly)}%` }}
                  ></div>
                </div>
                <div className="progress-stats">
                  <span>{formatProgress(goals.yearly)}</span>
                  <span>{getProgressPercentage(goals.yearly).toFixed(0)}%</span>
                </div>
              </div>
              
              <button 
                className="details-button" 
                onClick={() => toggleDetails('yearly')}
              >
                {showingDetails === 'yearly' ? 'Hide Details' : 'Show Details'}
              </button>
              
              {showingDetails === 'yearly' && (
                <div className="goal-details">
                  <h4>Progress History</h4>
                  <div className="history-list">
                    {progressHistory.yearly.slice(-5).map((year, index) => (
                      <div key={index} className="history-item">
                        <span>{year.year}</span>
                        <span>{convertDistance(year.distance, goals.yearly.unit)} {goals.yearly.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 