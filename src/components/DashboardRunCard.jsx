import PropTypes from 'prop-types';

const styles = {
  card: {
    backgroundColor: '#1a222e',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '16px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  content: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#f3f4f6',
    marginBottom: '4px',
  },
  date: {
    fontSize: '0.875rem',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  metricsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(1, 1fr)',
    gap: '8px',
    marginTop: '8px',
  },
  metricCard: {
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    borderRadius: '8px',
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    border: '1px solid rgba(75, 85, 99, 0.2)',
  },
  metricIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '10px',
    width: '32px',
    height: '32px',
    borderRadius: '8px',
  },
  distanceIcon: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: '#10B981',
  },
  durationIcon: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#3B82F6',
  },
  paceIcon: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    color: '#F59E0B',
  },
  metricDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: '0.75rem',
    color: '#9ca3af',
  },
  metricValue: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#f3f4f6',
  },
  actionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(75, 85, 99, 0.3)',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '8px 16px',
    fontSize: '0.875rem',
    fontWeight: '500',
    borderRadius: '8px',
    backgroundColor: 'rgba(75, 85, 99, 0.2)',
    color: '#f3f4f6',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.2s',
  },
  shareButton: {
    color: '#8B5CF6',
  },
  saveButton: {
    color: '#10B981',
  },
  deleteButton: {
    color: '#EF4444',
  },
  buttonIcon: {
    marginRight: '8px',
  }
};

export function DashboardRunCard({ 
  run, 
  formatTime, 
  displayDistance, 
  distanceUnit, 
  onShare, 
  onSave, 
  onDelete,
  isSaving,
  isWorkoutSaved,
  isDeleting
}) {
  return (
    <div style={styles.card}>
      <div style={styles.content}>
        <div style={styles.header}>
          <div style={styles.titleArea}>
            <h3 style={styles.title}>{run.title}</h3>
            <div style={styles.date}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>{run.date}</span>
            </div>
          </div>
        </div>

        <div style={styles.metricsContainer}>
          <div style={styles.metricCard}>
            <div style={{...styles.metricIcon, ...styles.distanceIcon}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <div style={styles.metricDetails}>
              <span style={styles.metricLabel}>Distance</span>
              <span style={styles.metricValue}>{displayDistance(run.distance, distanceUnit)}</span>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={{...styles.metricIcon, ...styles.durationIcon}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div style={styles.metricDetails}>
              <span style={styles.metricLabel}>Duration</span>
              <span style={styles.metricValue}>{formatTime(run.duration)}</span>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={{...styles.metricIcon, ...styles.paceIcon}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
            </div>
            <div style={styles.metricDetails}>
              <span style={styles.metricLabel}>Pace</span>
              <span style={styles.metricValue}>
                {run.distance > 0 
                  ? (run.duration / 60 / (distanceUnit === 'km' ? run.distance/1000 : run.distance/1609.344)).toFixed(2) 
                  : '0.00'} min/{distanceUnit}
              </span>
            </div>
          </div>
        </div>

        <div style={styles.actionsContainer}>
          <button 
            style={{...styles.actionButton, ...styles.shareButton}}
            onClick={() => onShare(run)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.buttonIcon}>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
            Share to Nostr
          </button>
          
          <button 
            style={{...styles.actionButton, ...styles.saveButton}}
            onClick={() => onSave(run)}
            disabled={isSaving || isWorkoutSaved}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.buttonIcon}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            {isSaving ? 'Saving...' : isWorkoutSaved ? 'Record Saved' : 'Save Workout Record'}
          </button>
          
          <button 
            style={{...styles.actionButton, ...styles.deleteButton}}
            onClick={() => onDelete(run)}
            disabled={isDeleting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.buttonIcon}>
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

DashboardRunCard.propTypes = {
  run: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    date: PropTypes.string.isRequired,
    distance: PropTypes.number.isRequired,
    duration: PropTypes.number.isRequired,
  }).isRequired,
  formatTime: PropTypes.func.isRequired,
  displayDistance: PropTypes.func.isRequired,
  distanceUnit: PropTypes.string.isRequired,
  onShare: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isSaving: PropTypes.bool,
  isWorkoutSaved: PropTypes.bool,
  isDeleting: PropTypes.bool
};

DashboardRunCard.defaultProps = {
  isSaving: false,
  isWorkoutSaved: false,
  isDeleting: false
};

export default DashboardRunCard; 