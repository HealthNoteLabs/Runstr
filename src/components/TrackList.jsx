import PropTypes from 'prop-types';
import { useContext, useState, useEffect } from 'react';
import { AudioContext } from '../contexts/audioContext';
import { TrackListItem } from './TrackListItem';
import './TrackList.css';

export function TrackList({
  tracks,
  currentTrack,
  onTrackClick
}) {
  const { isPlaying } = useContext(AudioContext);
  const [wallet, setWallet] = useState(null);

  // Attempt to get wallet from global state or context
  useEffect(() => {
    // For demonstration - in a real implementation, get this from a wallet context
    const connectedWallet = window.nostr?.nwc || null;
    setWallet(connectedWallet);
  }, []);

  return (
    <div className="track-list">
      {tracks.map((track, index) => (
        <TrackListItem
          key={track.id}
          track={track}
          position={index + 1}
          isPlaying={currentTrack?.id === track.id && isPlaying}
          wallet={wallet}
          onPlay={(track) => {
            if (currentTrack?.id === track.id && isPlaying) {
              // If the same track is already playing, this acts as a pause
              onTrackClick({ ...track, playToggle: true });
            } else {
              onTrackClick(track);
            }
          }}
        />
      ))}
    </div>
  );
}

TrackList.propTypes = {
  tracks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      artist: PropTypes.string.isRequired,
      albumArtUrl: PropTypes.string
    })
  ).isRequired,
  currentTrack: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired
  }),
  onTrackClick: PropTypes.func.isRequired
};
