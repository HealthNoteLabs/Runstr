import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { useRunTracker } from '../contexts/RunTrackerContext';
import { useSettings } from '../contexts/SettingsContext';

export const PlannedDistanceSelector = () => {
  const { 
    plannedDistance, 
    isPlannedRun, 
    isTracking, 
    setPlannedDistance, 
    clearPlannedDistance 
  } = useRunTracker();
  
  const { distanceUnit } = useSettings();
  const [selectedDistance, setSelectedDistance] = useState(null);

  // Define distance options in meters
  const distanceOptions = [
    { 
      id: '5k', 
      label: '5K', 
      meters: 5000,
      displayKm: '5.0 km',
      displayMi: '3.1 mi'
    },
    { 
      id: '10k', 
      label: '10K', 
      meters: 10000,
      displayKm: '10.0 km', 
      displayMi: '6.2 mi'
    },
    { 
      id: '21k', 
      label: '21K', 
      meters: 21097,
      displayKm: '21.1 km',
      displayMi: '13.1 mi'
    }
  ];

  // Update selected distance when plannedDistance changes
  useEffect(() => {
    if (plannedDistance) {
      const option = distanceOptions.find(opt => opt.meters === plannedDistance);
      setSelectedDistance(option?.id || null);
    } else {
      setSelectedDistance(null);
    }
  }, [plannedDistance]);

  const handleDistanceSelect = (option) => {
    if (isTracking) return; // Prevent changes during active run
    
    if (selectedDistance === option.id) {
      // Deselect if clicking the same option
      setSelectedDistance(null);
      clearPlannedDistance();
    } else {
      // Select new distance
      setSelectedDistance(option.id);
      setPlannedDistance(option.meters);
    }
  };

  const handleClear = () => {
    if (isTracking) return;
    setSelectedDistance(null);
    clearPlannedDistance();
  };

  // Don't show if tracking is active
  if (isTracking) {
    return null;
  }

  return (
    <div className="bg-bg-secondary rounded-xl p-4 mb-4 border border-border-secondary">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center mr-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-text-primary">Planned Distance</span>
        </div>
        
        {isPlannedRun && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-text-muted hover:text-text-primary"
          >
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {distanceOptions.map((option) => {
          const isSelected = selectedDistance === option.id;
          const displayDistance = distanceUnit === 'km' ? option.displayKm : option.displayMi;
          
          return (
            <Button
              key={option.id}
              variant={isSelected ? "default" : "outline"}
              size="default"
              onClick={() => handleDistanceSelect(option)}
              className={`flex flex-col h-auto py-3 px-3 transition-all ${
                isSelected 
                  ? 'bg-primary text-text-primary border-primary' 
                  : 'hover:bg-bg-tertiary hover:border-border-primary'
              }`}
            >
              <span className="text-base font-semibold mb-1">{option.label}</span>
              <span className="text-xs opacity-75">{displayDistance}</span>
            </Button>
          );
        })}
      </div>

      {isPlannedRun && (
        <div className="mt-3 p-2 bg-bg-primary/50 rounded-lg border border-border-secondary">
          <div className="flex items-center text-sm text-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Run will auto-stop when target distance is reached</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlannedDistanceSelector;
