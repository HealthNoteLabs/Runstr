import PropTypes from 'prop-types';
import { useContext } from 'react';
import { AudioContext } from '../contexts/audioContext';

export function TrackList({
  tracks,
  currentTrack,
  onTrackClick,
  onAddToQueue
}) {
  const { isPlaying } = useContext(AudioContext);

  return (
    <div className="track-list">
      {tracks.map((track) => (
        <div
          key={track.id}
          className={`track-item ${currentTrack?.id === track.id ? 'active' : ''}`}
        >
          <div className="track-info" onClick={() => onTrackClick(track)}>
            <div className="track-title">{track.title}</div>
            <div className="track-artist">{track.artist}</div>
          </div>
          <div className="track-controls">
            <button
              className="play-button"
              onClick={() => onTrackClick(track)}
              aria-label={
                currentTrack?.id === track.id && isPlaying ? 'Pause' : 'Play'
              }
            >
              {currentTrack?.id === track.id && isPlaying ? '⏸️' : '▶️'}
            </button>
            <button
              className="queue-button"
              onClick={() => onAddToQueue(track)}
              aria-label="Add to queue"
            >
              ➕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

TrackList.propTypes = {
  tracks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      artist: PropTypes.string.isRequired
    })
  ).isRequired,
  currentTrack: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired
  }),
  onTrackClick: PropTypes.func.isRequired,
  onAddToQueue: PropTypes.func.isRequired
};
