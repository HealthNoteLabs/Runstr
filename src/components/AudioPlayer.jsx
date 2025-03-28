import PropTypes from 'prop-types';
import styles from '../assets/styles/AudioPlayer.module.css';
import { useEffect, useState } from 'react';
import { fetchPlaylist } from '../utils/wavlake';
import ReactAudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

export function AudioPlayer({ playlistId }) {
  const [playlist, setPlayList] = useState();

  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  const [currentTrack, setCurrentTrack] = useState();

  useEffect(() => {
    if (!playlistId) return;

    fetchPlaylist(playlistId)
      .then((pl) => {
        setPlayList(pl);
      })
      .catch((err) => {
        console.error('error in fetching playlist', err);
      });
  }, [playlistId]);

  useEffect(() => {
    if (playlist) {
      setCurrentTrack(playlist.tracks[currentTrackIndex]);
    }
  }, [playlist, currentTrackIndex]);

  const playNext = () => {
    setCurrentTrackIndex((current) =>
      current < playlist.tracks.length - 1 ? current + 1 : 0
    );
  };

  const playPrevious = () => {
    setCurrentTrackIndex((current) => (current > 0 ? current - 1 : 0));
  };

  if (!playlist || !currentTrack) return null;

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        <p>Selected Playlist: {playlist.title}</p>
        <p>Selected Track: {currentTrack.title}</p>
      </div>
      <ReactAudioPlayer
        autoPlay
        src={currentTrack.mediaUrl}
        onClickNext={playNext}
        onClickPrevious={playPrevious}
        onEnded={playNext}
        showJumpControls={false}
        showSkipControls
        className="bg-transparent"
        customProgressBarSection={['CURRENT_TIME', 'PROGRESS_BAR', 'DURATION']}
        customControlsSection={[
          'ADDITIONAL_CONTROLS',
          'MAIN_CONTROLS',
          'VOLUME_CONTROLS'
        ]}
      />
    </div>
  );
}

AudioPlayer.propTypes = {
  playlistId: PropTypes.string.isRequired
};
