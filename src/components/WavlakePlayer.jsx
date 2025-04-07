import PropTypes from 'prop-types';
import { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { getTrackStreamUrl } from '../utils/wavlake';

export const WavlakePlayer = ({ track, onEnded }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (track?.id) {
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
    }
  }, [track]);

  const handlePlay = () => {
    setIsPlaying(true);
    setError(null);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleError = (err) => {
    console.error('Playback error:', err);
    setError('Failed to play audio');
    setIsPlaying(false);
    setIsLoading(false);
  };

  const handleProgress = ({ playedSeconds }) => {
    setProgress(playedSeconds);
  };

  const handleDuration = (duration) => {
    setDuration(duration);
    setIsLoading(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (onEnded) onEnded();
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value) => {
    if (playerRef.current) {
      playerRef.current.seekTo(value);
      setProgress(value);
    }
  };

  const streamUrl = track?.id ? getTrackStreamUrl(track.id) : null;

  return (
    <div className="wavlake-player">
      {streamUrl && (
        <ReactPlayer
          ref={playerRef}
          url={streamUrl}
          playing={isPlaying}
          controls={false}
          width="0"
          height="0"
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleError}
          onProgress={handleProgress}
          onDuration={handleDuration}
          onEnded={handleEnded}
          config={{
            file: {
              forceAudio: true,
              attributes: {
                crossOrigin: 'anonymous',
                preload: 'auto'
              },
              forceHLS: false,
              forceDASH: false,
              hlsOptions: {
                enableWorker: false,
                debug: false
              },
              // Disable caching
              cache: false,
              // Enable range requests
              range: true
            }
          }}
        />
      )}

      <div className="track-info">
        <img src={track.artwork} alt={track.title} className="track-artwork" />
        <div className="track-details">
          <h3>{track.title}</h3>
          <p>{track.artist}</p>
        </div>
      </div>

      <div className="player-controls">
        <button
          onClick={togglePlay}
          disabled={isLoading || error || !streamUrl}
          className="play-button"
        >
          {isLoading ? '⌛' : isPlaying ? '⏸️' : '▶️'}
        </button>

        <div className="progress-bar">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={progress}
            onChange={(e) => handleSeek(Number(e.target.value))}
            disabled={isLoading || error || !streamUrl}
          />
          <div className="time">
            {formatTime(progress)} / {formatTime(duration)}
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

WavlakePlayer.propTypes = {
  track: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    artwork: PropTypes.string
  }).isRequired,
  onEnded: PropTypes.func
};

const formatTime = (seconds) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
