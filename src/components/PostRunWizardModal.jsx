import { useState, useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import { publishRun } from '../utils/runPublisher';
import { NostrContext } from '../contexts/NostrContext';
import { useSettings } from '../contexts/SettingsContext';
import { getWorkoutAssociations } from '../utils/teamChallengeHelper';

export const PostRunWizardModal = ({ run, onClose }) => {
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState(null);
  const [teamInfo, setTeamInfo] = useState(null);

  const { lightningAddress, publicKey } = useContext(NostrContext);
  const settings = useSettings();

  // Fetch team associations when modal opens
  useEffect(() => {
    const fetchTeamInfo = async () => {
      try {
        const associations = await getWorkoutAssociations();
        setTeamInfo(associations.teamAssociation);
      } catch (error) {
        console.warn('PostRunWizardModal: Error fetching team associations:', error);
        // Silently fail - modal still works without team info
        setTeamInfo(null);
      }
    };

    fetchTeamInfo();
  }, []);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const unit = localStorage.getItem('distanceUnit') || 'km';
      // Only publish the main workout record (NIP101e), no extras
      const results = await publishRun(run, unit, { 
        ...settings,
        // Override all NIP101h options to false, only publish main workout
        publishIntensity: false,
        publishCalories: false,
        publishDurationMetric: false,
        publishDistanceMetric: false,
        publishPaceMetric: false,
        publishElevationMetric: false,
        publishSteps: false,
        publishSplits: false
      });
      setPublishResults(results);

      // Reward logic removed - rewards are now handled via manual weekly process
      // const allSuccess = results && results.every(r => r.success);
    } catch (err) {
      console.error('PostRunWizardModal publish error', err);
      setPublishResults([{ success: false, error: err.message }]);
    } finally {
      setPublishing(false);
    }
  };

  // Helper function to format time
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const allSuccess = publishResults && publishResults.every(r => r.success);

  return (
    <div className="modal-overlay">
      <div className="modal-content post-run-wizard w-full max-w-md">
        <div>
          <h3 className="subsection-heading mb-4">Save Workout to Nostr</h3>
          <p className="mb-4 text-text-secondary">
            Your workout summary will be published to Nostr as a workout record.
          </p>
          
          <div className="mb-4 p-3 bg-bg-secondary rounded-md text-sm">
            <p><strong>Distance:</strong> {run.distance ? `${(run.distance / 1000).toFixed(2)} km` : 'N/A'}</p>
            <p><strong>Duration:</strong> {run.duration ? formatTime(run.duration) : 'N/A'}</p>
            <p><strong>Activity:</strong> {run.activityType || 'Run'}</p>
            <p><strong>Team:</strong> {teamInfo?.teamName || 'None'}</p>
          </div>
          
          <div className="status-section mt-3">
            {publishing && <span className="text-text-secondary">🔄 Publishing workout record...</span>}
            {allSuccess && <span className="text-text-primary">✅ Workout record published successfully!</span>}
          </div>

          <div className="flex justify-end gap-3">
            <button 
              className="px-4 py-2 border-2 border-white rounded-md text-white hover:bg-white hover:text-black transition-colors" 
              onClick={onClose} 
              disabled={publishing && !publishResults}
            >
              {publishResults ? 'Close' : 'Cancel'}
            </button>
            {!publishResults && (
              <button 
                className="px-5 py-2 bg-black hover:bg-gray-800 text-white border-2 border-white font-bold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handlePublish} 
                disabled={publishing}
              >
                {publishing ? 'Publishing...' : 'Publish Workout'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

PostRunWizardModal.propTypes = {
  run: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired
}; 