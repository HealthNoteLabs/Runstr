import PropTypes from 'prop-types';
import { formatDate, displayDistance, formatTime } from '../utils/formatters';

const DeleteConfirmationDialog = ({ isOpen, run, onConfirm, onCancel, distanceUnit }) => {
  if (!isOpen || !run) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content delete-confirmation">
        <h3>Delete Run?</h3>
        <div className="run-details">
          <p><strong>Date:</strong> {formatDate(run.date)}</p>
          <p><strong>Distance:</strong> {displayDistance(run.distance, distanceUnit)}</p>
          <p><strong>Duration:</strong> {formatTime(run.duration)}</p>
          {run.elevation && (
            <>
              <p><strong>Elevation Gain:</strong> {run.elevation.gain}m</p>
              <p><strong>Elevation Loss:</strong> {run.elevation.loss}m</p>
            </>
          )}
        </div>
        <p className="warning">
          This will permanently remove this run and update all your stats.
          This action cannot be undone.
        </p>
        <div className="button-container">
          <button className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="delete-button" onClick={onConfirm}>
            Delete Run
          </button>
        </div>
      </div>
    </div>
  );
};

DeleteConfirmationDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  run: PropTypes.shape({
    date: PropTypes.string.isRequired,
    distance: PropTypes.number.isRequired,
    duration: PropTypes.number.isRequired,
    elevation: PropTypes.shape({
      gain: PropTypes.number.isRequired,
      loss: PropTypes.number.isRequired
    })
  }),
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  distanceUnit: PropTypes.oneOf(['km', 'mi']).isRequired
};

export default DeleteConfirmationDialog; 