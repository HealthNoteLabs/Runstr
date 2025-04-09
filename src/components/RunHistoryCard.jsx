import PropTypes from 'prop-types';

const styles = {
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

export const RunHistoryCard = ({
  run,
  distanceUnit,
  formatDate,
  formatTime,
  displayDistance,
  formatElevation,
  pace,
  caloriesBurned,
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
  return (
    <div style={styles.card}>
      {/* Header with date and delete icon */}
      <div style={styles.header}>
        <span style={styles.date}>{formatDate(run.date)}</span>
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
      
      {/* Metrics grid */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>Duration</span>
          <span style={styles.metricValue}>{formatTime(run.duration)}</span>
        </div>
        
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>Distance</span>
          <span style={styles.metricValue}>{displayDistance(run.distance, distanceUnit)}</span>
        </div>
        
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>Pace</span>
          <span style={styles.metricValue}>{pace} min/{distanceUnit}</span>
        </div>
        
        <div style={styles.metricItem}>
          <span style={styles.metricLabel}>Calories</span>
          <span style={styles.metricValue}>{caloriesBurned} kcal</span>
        </div>
        
        {run.elevation && (
          <>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Elevation Gain</span>
              <span style={styles.metricValue}>{formatElevation(run.elevation.gain, distanceUnit)}</span>
            </div>
            
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Elevation Loss</span>
              <span style={styles.metricValue}>{formatElevation(run.elevation.loss, distanceUnit)}</span>
            </div>
          </>
        )}
      </div>
      
      {/* Splits toggle */}
      {run.splits && run.splits.length > 0 && (
        <button 
          style={styles.splitsToggle}
          onClick={(e) => onToggleSplits(e, run.id)}
        >
          {expandedRuns.has(run.id) ? '▲ Hide Splits' : '▼ Show Splits'}
        </button>
      )}
      
      {/* Splits table */}
      {expandedRuns.has(run.id) && run.splits && run.splits.length > 0 && (
        <div style={styles.splitsContainer}>
          <SplitsTable splits={run.splits} distanceUnit={distanceUnit} />
        </div>
      )}
      
      {/* Action buttons */}
      <div style={styles.actionsContainer}>
        <button
          style={styles.actionButton}
          onClick={() => onPostToNostr(run)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
            <polyline points="16 6 12 2 8 6"></polyline>
            <line x1="12" y1="2" x2="12" y2="15"></line>
          </svg>
          Share to Nostr
        </button>
        
        <button
          style={{
            ...styles.actionButton,
            ...(isSavingWorkout || isWorkoutSaved ? styles.disabled : {})
          }}
          onClick={() => onSaveWorkout(run)}
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
    </div>
  );
};

RunHistoryCard.propTypes = {
  run: PropTypes.object.isRequired,
  distanceUnit: PropTypes.string.isRequired,
  formatDate: PropTypes.func.isRequired,
  formatTime: PropTypes.func.isRequired,
  displayDistance: PropTypes.func.isRequired,
  formatElevation: PropTypes.func.isRequired,
  pace: PropTypes.string.isRequired,
  caloriesBurned: PropTypes.number.isRequired,
  isWorkoutSaved: PropTypes.bool.isRequired,
  isSavingWorkout: PropTypes.bool.isRequired,
  savingWorkoutRunId: PropTypes.string,
  expandedRuns: PropTypes.instanceOf(Set).isRequired,
  onPostToNostr: PropTypes.func.isRequired,
  onSaveWorkout: PropTypes.func.isRequired,
  onDeleteClick: PropTypes.func.isRequired,
  onToggleSplits: PropTypes.func.isRequired,
  SplitsTable: PropTypes.elementType.isRequired
};

export default RunHistoryCard; 