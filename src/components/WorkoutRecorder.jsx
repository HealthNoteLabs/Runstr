import { useState } from 'react';
import PropTypes from 'prop-types';
import { createAndPublishEvent } from '../utils/nostr';
import { createWorkoutEvent } from '../utils/workoutUtils';

/**
 * Component for saving run data as a workout record on Nostr
 */
export const WorkoutRecorder = ({ 
  runData, 
  distanceUnit = 'km',
  onSuccess, 
  onError 
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /**
   * Handle saving workout record to Nostr
   */
  const handleSaveWorkout = async () => {
    if (!runData) {
      onError(new Error('No run data provided'));
      return;
    }
    
    if (saved) {
      onError(new Error('Workout already saved'));
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Create a standardized workout event
      const workoutEvent = createWorkoutEvent(runData, distanceUnit);
      
      // Publish to Nostr
      await createAndPublishEvent(workoutEvent);
      
      // Update state and notify success
      setSaved(true);
      onSuccess();
      
      // Show success message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Workout record saved to Nostr!');
      }
    } catch (error) {
      console.error('Error saving workout record:', error);
      setSaved(false);
      onError(error);
      
      // Show error message
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Failed to save workout: ' + error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!runData) {
    return null;
  }

  return (
    <div className="workout-recorder">
      <button 
        onClick={handleSaveWorkout}
        disabled={isSaving || saved}
        className={`save-workout-btn ${saved ? 'saved' : ''}`}
      >
        {isSaving ? 'Saving...' : saved ? 'Workout Saved ✓' : 'Save as Workout Record'}
      </button>
      
      {saved && (
        <div className="workout-saved-info">
          <p>This workout has been saved to the Nostr network and can be viewed by others in your running community.</p>
        </div>
      )}
    </div>
  );
};

WorkoutRecorder.propTypes = {
  runData: PropTypes.shape({
    distance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    duration: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    pace: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    date: PropTypes.string,
    splits: PropTypes.array,
    elevation: PropTypes.shape({
      gain: PropTypes.number,
      loss: PropTypes.number
    })
  }),
  distanceUnit: PropTypes.string,
  onSuccess: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired
}; 