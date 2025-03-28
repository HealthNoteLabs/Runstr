import { useReducer, useState, useEffect, useCallback, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import { AudioPlayerContext, initialState, audioReducer } from './audioPlayerContext';
import { fetchPlaylist } from '../utils/wavlake';

// Lazy load the audio player to improve initial page load time
const ReactAudioPlayer = lazy(() => import('react-h5-audio-player').then(module => {
  // Also import the CSS only when the component is loaded
  import('react-h5-audio-player/lib/styles.css');
  return module;
}));

export const AudioPlayerProvider = ({ children }) => {
  const [state, dispatch] = useReducer(audioReducer, initialState);
  
  // Local state for playlist and current track
  const [playlist, setPlaylist] = useState(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [audioPlayerRef, setAudioPlayerRef] = useState(null);
  const [audioPlayerLoaded, setAudioPlayerLoaded] = useState(false);

  // Load playlist when playlist ID changes, but don't auto-play to improve performance
  const loadPlaylist = async (playlistId) => {
    try {
      console.log(`Loading playlist: ${playlistId}`);
      const fetchedPlaylist = await fetchPlaylist(playlistId);
      
      // Validate playlist structure
      if (!fetchedPlaylist) {
        console.error(`Playlist not found: ${playlistId}`);
        alert(`Could not load playlist: Playlist not found`);
        return;
      }
      
      if (!fetchedPlaylist.tracks || !Array.isArray(fetchedPlaylist.tracks)) {
        console.error(`Invalid playlist format: ${playlistId}`, fetchedPlaylist);
        alert(`Could not load playlist: Invalid playlist format`);
        return;
      }
      
      if (fetchedPlaylist.tracks.length === 0) {
        console.warn(`Playlist is empty: ${playlistId}`);
        alert(`This playlist is empty`);
        return;
      }
      
      console.log(`Playlist loaded: ${fetchedPlaylist.title} (${fetchedPlaylist.tracks.length} tracks)`);
      
      setPlaylist(fetchedPlaylist);
      setCurrentTrackIndex(0);
      
      // Validate first track
      const firstTrack = fetchedPlaylist.tracks[0];
      if (!firstTrack.mediaUrl) {
        console.error(`Track missing media URL:`, firstTrack);
        alert(`Error: Track missing media URL`);
        return;
      }
      
      dispatch({ type: 'SET_TRACK', payload: firstTrack });
      // Now we can load the audio player component if it's not already loaded
      setAudioPlayerLoaded(true);
    } catch (error) {
      console.error('Error loading playlist:', error);
      alert(`Failed to load playlist: ${error.message}`);
    }
  };

  // Update current track when currentTrackIndex changes
  useEffect(() => {
    if (playlist && playlist.tracks && playlist.tracks.length > 0) {
      dispatch({ type: 'SET_TRACK', payload: playlist.tracks[currentTrackIndex] });
      // If we're not on the first track, and a track is already playing, 
      // keep playing when we change tracks
      if (state.isPlaying && audioPlayerRef?.audio?.current) {
        // Small timeout to ensure the new track is loaded before playing
        setTimeout(() => {
          audioPlayerRef.audio.current?.play().catch(e => console.log('Auto-play prevented:', e));
        }, 100);
      }
    }
  }, [currentTrackIndex, playlist, state.isPlaying, audioPlayerRef]);

  // Play next track
  const playNext = useCallback(() => {
    if (playlist && playlist.tracks) {
      setCurrentTrackIndex((current) =>
        current < playlist.tracks.length - 1 ? current + 1 : 0
      );
    }
  }, [playlist]);

  // Play previous track
  const playPrevious = useCallback(() => {
    if (playlist && playlist.tracks) {
      setCurrentTrackIndex((current) => (current > 0 ? current - 1 : 0));
    }
  }, [playlist]);

  // Skip to a specific track by index
  const skipToTrack = useCallback((trackIndex) => {
    if (playlist && playlist.tracks && trackIndex >= 0 && trackIndex < playlist.tracks.length) {
      setCurrentTrackIndex(trackIndex);
      dispatch({ type: 'PLAY' });
    }
  }, [playlist, dispatch]);

  // Play/pause toggle
  const togglePlayPause = useCallback(() => {
    if (!audioPlayerLoaded) {
      setAudioPlayerLoaded(true);
      // Wait for the component to load
      setTimeout(() => {
        dispatch({ type: 'PLAY' });
        setTimeout(() => {
          audioPlayerRef?.audio?.current?.play().catch(e => console.log('Play prevented:', e));
        }, 100);
      }, 200);
      return;
    }

    if (state.isPlaying) {
      dispatch({ type: 'PAUSE' });
      audioPlayerRef?.audio?.current?.pause();
    } else {
      dispatch({ type: 'PLAY' });
      audioPlayerRef?.audio?.current?.play().catch(e => console.log('Play prevented:', e));
    }
  }, [state.isPlaying, audioPlayerRef, dispatch, audioPlayerLoaded]);

  // Handle track ended event
  const handleTrackEnded = useCallback(() => {
    // Set a small timeout to ensure state updates properly
    setTimeout(() => {
      playNext();
      dispatch({ type: 'PLAY' });
    }, 50);
  }, [playNext, dispatch]);

  return (
    <AudioPlayerContext.Provider
      value={{
        ...state,
        dispatch,
        loadPlaylist,
        playNext,
        playPrevious,
        skipToTrack,
        togglePlayPause,
        playlist,
        currentTrackIndex,
        setAudioPlayerRef
      }}
    >
      {children}
      {state.currentTrack && audioPlayerLoaded && (
        <div className="global-audio-player" style={{ display: 'none' }}>
          <Suspense fallback={<div>Loading player...</div>}>
            <ReactAudioPlayer
              ref={setAudioPlayerRef}
              autoPlay={state.isPlaying}
              src={state.currentTrack.mediaUrl}
              onClickNext={playNext}
              onClickPrevious={playPrevious}
              onEnded={handleTrackEnded}
              onPlay={() => dispatch({ type: 'PLAY' })}
              onPause={() => dispatch({ type: 'PAUSE' })}
              showJumpControls={false}
              showSkipControls
            />
          </Suspense>
        </div>
      )}
    </AudioPlayerContext.Provider>
  );
};

AudioPlayerProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 