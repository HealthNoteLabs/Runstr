import React, { useState } from 'react'; // Assuming useState might be needed for loading/error states
import { useNavigate } from 'react-router-dom';
import { useNostr } from '../hooks/useNostr'; // Adjust path as needed
import { getDefaultPostingTeamIdentifier } from '../utils/settingsManager'; // Adjust path
import { createWorkoutEvent, createAndPublishEvent } from '../utils/nostr'; // Adjust path
import { getTimeOfDay } from '../utils/formatters'; // Import getTimeOfDay
import { ACTIVITY_TYPES } from '../services/RunDataService'; // Ensuring this import is present

const styles: Record<string, React.CSSProperties> = {
  card: {
    width: '100%',
    margin: '0 auto 16px auto',
    backgroundColor: '#1a1f2b',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  date: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#a5adcf',
  },
  deleteButton: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    padding: '12px 16px',
  },
  metricItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginBottom: '4px',
  },
  metricValue: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#e2e8f0',
  },
  metricUnit: {
    fontSize: '0.75rem',
    color: '#a5adcf',
    marginLeft: '4px',
  },
  splitsToggle: {
    background: 'rgba(79, 70, 229, 0.2)',
    color: '#8B5CF6',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    margin: '8px auto',
    fontWeight: '500',
    display: 'block',
    width: '100%',
    textAlign: 'center',
  },
  actionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    borderRadius: '8px',
    background: 'rgba(79, 70, 229, 0.2)',
    color: '#8B5CF6',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '0.875rem',
    width: '100%',
    transition: 'all 0.2s',
  },
  deleteActionButton: {
    background: 'rgba(220, 38, 38, 0.1)',
    color: '#ef4444',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  splitsContainer: {
    padding: '0 16px 16px 16px',
  }
};

interface RunData {
  id: string; // Assuming each run has an ID
  distance: number;
  duration: number;
  activityType?: string;
  notes?: string;
  title?: string;
  date?: number | string; // timestamp or ISO string
  elevation?: { gain: number; loss: number };
  // Add other fields that runDataService.saveRun and createWorkoutEvent expect
  unit?: string; // 'km' or 'mi' - Important for createWorkoutEvent
  // Ensure all fields used by createWorkoutEvent are present from the local run object
  splits?: any[]; // Added to match usage, define more strictly if possible
}

interface RunHistoryCardProps {
  run: RunData;
  distanceUnit: string;
  formatDate: (date?: number | string) => string; // Optional date
  formatTime: (secs: number) => string;
  displayDistance: (meters: number, unit: string) => string;
  formatElevation: (gain?: number, loss?: number, unit?: string) => string; // Optional gain/loss/unit
  pace: string;
  caloriesBurned: number;
  activityType: string | undefined;
  displayMetricValue: string | number | undefined;
  displayMetricLabel: string | undefined;
  displayMetricUnit: string | undefined;
  isWorkoutSaved: boolean;
  isSavingWorkout: boolean;
  savingWorkoutRunId: string | undefined;
  expandedRuns: Set<string>;
  onPostToNostr: (run: RunData) => void;
  onSaveWorkout: (run: RunData) => void;
  onDeleteClick: (run: RunData) => void;
  onToggleSplits: (e: React.MouseEvent<HTMLButtonElement>, runId: string) => void;
  SplitsTable: React.ElementType;
}

export const RunHistoryCard: React.FC<RunHistoryCardProps> = ({
  run,
  distanceUnit,
  formatDate,
  formatTime,
  displayDistance,
  formatElevation,
  pace,
  caloriesBurned,
  activityType,
  displayMetricValue,
  displayMetricLabel,
  displayMetricUnit,
  isWorkoutSaved,
  isSavingWorkout,
  savingWorkoutRunId,
  expandedRuns,
  onPostToNostr,
  onSaveWorkout,
  onDeleteClick,
  onToggleSplits,
  SplitsTable
}) => {
  const navigate = useNavigate();
  const { ndk, publicKey, ndkReady } = useNostr();
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  let metricLabelToDisplay;
  let metricValueToDisplay;
  let metricUnitToDisplay = '';

  const currentActivityType = activityType || run.activityType;

  if (currentActivityType === ACTIVITY_TYPES.WALK && displayMetricValue !== undefined) {
    metricLabelToDisplay = displayMetricLabel || 'Steps';
    metricValueToDisplay = Math.round(typeof displayMetricValue === 'number' ? displayMetricValue : parseFloat(displayMetricValue));
    metricUnitToDisplay = displayMetricUnit || '';
  } else if (currentActivityType === ACTIVITY_TYPES.CYCLE && displayMetricValue !== undefined) {
    metricLabelToDisplay = displayMetricLabel || 'Speed';
    metricValueToDisplay = displayMetricValue;
    metricUnitToDisplay = displayMetricUnit || (distanceUnit === 'km' ? 'km/h' : 'mph');
  } else {
    metricLabelToDisplay = "Pace";
    metricValueToDisplay = pace;
    metricUnitToDisplay = `min/${distanceUnit}`;
  }
  
  const handleShareToNostr = async () => {
    if (run && (run as any).nostrWorkoutEventId) {
      setShareError('This workout has already been shared to Nostr.');
      setTimeout(() => setShareError(null), 5000);
      return;
    }
    if (!ndkReady || !ndk || !publicKey) {
      setShareError('Nostr client not ready or not logged in.');
      setTimeout(() => setShareError(null), 5000);
      return;
    }

    setIsSharing(true);
    setShareError(null);
    setShareSuccess(null);

    try {
      // Use publishRun() for consistent team/challenge association logic
      const { publishRun } = await import('../utils/runPublisher');
      
      const eventRunData: RunData = {
          ...run,
          activityType: run.activityType || 'run',
          date: run.date || Date.now(),
          title: run.title || `${run.activityType || 'Activity'} on ${new Date(run.date || Date.now()).toLocaleDateString()}`,
          notes: run.notes || '',
          unit: distanceUnit,
      };

      const results = await publishRun(eventRunData, distanceUnit, {});
      
      // Check if the summary (kind 1301) was successfully published
      const summaryResult = results.find(r => r.kind === 1301);
      if (summaryResult && summaryResult.success && summaryResult.result?.id) {
        console.log('RunHistoryCard: Workout event published:', summaryResult.result);
        setShareSuccess('Successfully shared to Nostr!');
                 // Update the run record with the published event ID
         if (eventRunData.id && summaryResult.result.id) {
           const runDataService = await import('../services/RunDataService');
           runDataService.default.updateRun(eventRunData.id, { nostrWorkoutEventId: summaryResult.result.id });
         }
      } else {
        console.error("RunHistoryCard: Publishing failed:", summaryResult?.error);
        setShareError(summaryResult?.error || 'Failed to share to Nostr. Check relay connections.');
      }
    } catch (err: any) {
      console.error('RunHistoryCard: Error sharing to Nostr:', err);
      setShareError(err.message || 'An unknown error occurred during sharing.');
    } finally {
      setIsSharing(false);
      setTimeout(() => { 
        setShareError(null); 
        setShareSuccess(null); 
      }, 5000);
    }
  };
  
  const handleSaveWorkoutRecord = async () => {
    alert('"Save Workout Record" currently saves locally. Use "Share to Nostr" to publish a NIP-101e event with team tags.');
  };

  const displayDuration = (secs: number = 0) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const displayPace = () => {
    if (run.distance > 0 && run.duration > 0) {
        const paceMinPerUnit = (run.duration / 60) / (distanceUnit === 'km' ? run.distance / 1000 : run.distance / 1609.344);
        const minutes = Math.floor(paceMinPerUnit);
        const seconds = Math.round((paceMinPerUnit - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')} min/${distanceUnit}`;
    }
    return '--:--';
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.date}>{formatDate(run.date)} - {getTimeOfDay(run.date || Date.now())}</span>
        <button 
          style={styles.deleteButton}
          onClick={() => onDeleteClick(run)}
          aria-label="Delete run"
          title="Delete this run"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      
      <div style={styles.metricsGrid}>
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>Duration</span>
          <span style={styles.metricValue}>{displayDuration(run.duration)}</span>
        </div>
        
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>Distance</span>
          <span style={styles.metricValue}>{displayDistance(run.distance, distanceUnit)}</span>
        </div>
        
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>{metricLabelToDisplay}</span>
          <span style={styles.metricValue}>
            {metricValueToDisplay}
            {metricUnitToDisplay && metricUnitToDisplay !== `min/${distanceUnit}` && (
              <span style={styles.metricUnit}>{metricUnitToDisplay}</span>
            )}
            {metricLabelToDisplay === "Pace" && !metricUnitToDisplay.startsWith('min/') && ` ${metricUnitToDisplay}`}
          </span>
        </div>
        
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>Calories</span>
          <span style={styles.metricValue}>{caloriesBurned} kcal</span>
        </div>
        
        {run.elevation && (
          <>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Elevation Gain</span>
              <span style={styles.metricValue}>{formatElevation(run.elevation.gain, run.elevation.loss, distanceUnit)}</span>
            </div>
            
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Elevation Loss</span>
              <span style={styles.metricValue}>{formatElevation(run.elevation.gain, run.elevation.loss, distanceUnit)}</span>
            </div>
          </>
        )}
      </div>
      
      {run.splits && run.splits.length > 0 && (
        <button 
          style={styles.splitsToggle}
          onClick={(e) => onToggleSplits(e, run.id)}
        >
          {expandedRuns.has(run.id) ? '▲ Hide Splits' : '▼ Show Splits'}
        </button>
      )}
      
      {expandedRuns.has(run.id) && run.splits && run.splits.length > 0 && (
        <div style={styles.splitsContainer}>
          <SplitsTable splits={run.splits} distanceUnit={distanceUnit} />
        </div>
      )}
      
      <div style={styles.actionsContainer}>
        <button
          style={styles.actionButton}
          onClick={handleShareToNostr}
          disabled={isSharing || !ndkReady}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
            <polyline points="16 6 12 2 8 6"></polyline>
            <line x1="12" y1="2" x2="12" y2="15"></line>
          </svg>
          {isSharing ? 'Sharing to Nostr...' : 'Share to Nostr'}
        </button>
        
        <button
          style={{
            ...styles.actionButton,
            ...(isSavingWorkout || isWorkoutSaved ? styles.disabled : {})
          }}
          onClick={handleSaveWorkoutRecord}
          disabled={isSavingWorkout || isWorkoutSaved}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          {isSavingWorkout && savingWorkoutRunId === run.id ? 'Saving...' : isWorkoutSaved ? 'Record Saved' : 'Save Workout Record'}
        </button>
        
        <button
          style={{...styles.actionButton, ...styles.deleteActionButton}}
          onClick={() => onDeleteClick(run)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
          Delete
        </button>
      </div>
      {!ndkReady && <p className="text-xs text-yellow-500 mt-1 text-center sm:text-right">Nostr not ready</p>}
    </div>
  );
};

export default RunHistoryCard; 