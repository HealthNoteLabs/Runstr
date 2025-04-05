import styles from '../assets/styles/PlaylistSection.module.css';
import PropTypes from 'prop-types';

export const PlaylistSection = ({ title, playlists, handlePlaylistClick }) => {
  return (
    <div className={styles.playlistSection}>
      <h2>{title}</h2>
      <div className={styles.playlistsContainer}>
        {playlists.map(({ id, title: playlistTitle, tracks, isPrivate }) => (
          <div
            key={id}
            className={styles.playlist}
            onClick={() => handlePlaylistClick(id)}
          >
            <div className={styles.playlistArt}>
              {tracks
                .slice(0, 4)
                .map(({ id, artworkUrl, albumArtUrl, title: trackTitle }) => (
                  <img
                    key={id}
                    src={artworkUrl ?? albumArtUrl}
                    alt={`${trackTitle} art`}
                    width={500}
                    height={500}
                  />
                ))}
            </div>
            <div className={styles.playlistMetadata}>
              <p>{playlistTitle}</p>
              <p>{tracks.length} tracks</p>
              {isPrivate && (
                <small>Private (must be logged in with to play)</small>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

PlaylistSection.propTypes = {
  title: PropTypes.string.isRequired,
  playlists: PropTypes.array.isRequired,
  handlePlaylistClick: PropTypes.func.isRequired
};
