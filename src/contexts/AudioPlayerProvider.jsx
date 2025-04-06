import { useReducer, useState, useEffect, useCallback, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import { AudioPlayerContext, initialState, audioReducer, REPEAT_MODES } from './audioPlayerContext';
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
  const [shuffledIndices, setShuffledIndices] = useState([]); // Store shuffled order of tracks

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

  // Generate shuffled playlist indices
  const generateShuffledIndices = useCallback(() => {
    if (!playlist || !playlist.tracks) return;
    
    const indices = Array.from({ length: playlist.tracks.length }, (_, i) => i);
    // Fisher-Yates shuffle algorithm
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // Ensure current track is first in the shuffled order if we're already playing
    if (state.isPlaying && currentTrackIndex !== undefined) {
      const currentIndex = indices.indexOf(currentTrackIndex);
      if (currentIndex > 0) {
        indices.splice(currentIndex, 1);
        indices.unshift(currentTrackIndex);
      }
    }
    
    setShuffledIndices(indices);
  }, [playlist, currentTrackIndex, state.isPlaying]);

  // Toggle shuffle mode
  const toggleShuffle = useCallback(() => {
    if (!state.shuffleMode) {
      // Turning shuffle on
      generateShuffledIndices();
    }
    dispatch({ type: 'TOGGLE_SHUFFLE' });
  }, [state.shuffleMode, generateShuffledIndices, dispatch]);

  // Set repeat mode
  const setRepeatMode = useCallback((mode) => {
    dispatch({ type: 'SET_REPEAT_MODE', payload: mode });
  }, [dispatch]);
  
  // Cycle through repeat modes
  const cycleRepeatMode = useCallback(() => {
    const modes = Object.values(REPEAT_MODES);
    const currentIndex = modes.indexOf(state.repeatMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  }, [state.repeatMode, setRepeatMode]);

  // Update shuffled indices when playlist changes or shuffle is toggled
  useEffect(() => {
    if (state.shuffleMode) {
      generateShuffledIndices();
    }
  }, [state.shuffleMode, playlist, generateShuffledIndices]);

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

  // Get next track index based on current mode (shuffle/repeat)
  const getNextTrackIndex = useCallback(() => {
    if (!playlist || !playlist.tracks) return 0;
    
    const totalTracks = playlist.tracks.length;
    
    if (state.shuffleMode) {
      // Find current position in shuffled list
      const currentShuffleIndex = shuffledIndices.indexOf(currentTrackIndex);
      // Get next index in shuffled order, or loop back to beginning
      const nextShuffleIndex = (currentShuffleIndex + 1) % totalTracks;
      return shuffledIndices[nextShuffleIndex];
    } else {
      // Normal sequential playback
      if (currentTrackIndex < totalTracks - 1) {
        return currentTrackIndex + 1;
      } else if (state.repeatMode === REPEAT_MODES.PLAYLIST) {
        return 0; // Loop back to first track
      } else {
        return currentTrackIndex; // Stay on last track
      }
    }
  }, [playlist, currentTrackIndex, state.shuffleMode, state.repeatMode, shuffledIndices]);

  // Get previous track index based on current mode
  const getPreviousTrackIndex = useCallback(() => {
    if (!playlist || !playlist.tracks) return 0;
    
    // Check if we need to restart the current track
    // If user has listened to > 3 seconds, restart the current track
    const RESTART_THRESHOLD = 3000; // 3 seconds in milliseconds
    const currentTime = Date.now();
    const playTime = currentTime - state.trackStartTime;
    
    if (playTime < RESTART_THRESHOLD && audioPlayerRef?.audio?.current?.currentTime > 3) {
      return currentTrackIndex; // Restart current track
    }
    
    const totalTracks = playlist.tracks.length;
    
    if (state.shuffleMode) {
      // Find current position in shuffled list
      const currentShuffleIndex = shuffledIndices.indexOf(currentTrackIndex);
      // Get previous index in shuffled order, or loop to end
      const prevShuffleIndex = (currentShuffleIndex > 0) 
        ? currentShuffleIndex - 1 
        : (state.repeatMode === REPEAT_MODES.PLAYLIST ? totalTracks - 1 : 0);
      return shuffledIndices[prevShuffleIndex];
    } else {
      // Normal sequential playback
      if (currentTrackIndex > 0) {
        return currentTrackIndex - 1;
      } else if (state.repeatMode === REPEAT_MODES.PLAYLIST) {
        return totalTracks - 1; // Loop to last track
      } else {
        return 0; // Stay on first track
      }
    }
  }, [playlist, currentTrackIndex, state.shuffleMode, state.repeatMode, 
      state.trackStartTime, shuffledIndices, audioPlayerRef]);

  // Play next track
  const playNext = useCallback(() => {
    if (playlist && playlist.tracks) {
      const nextIndex = getNextTrackIndex();
      setCurrentTrackIndex(nextIndex);
    }
  }, [playlist, getNextTrackIndex]);

  // Play previous track or restart current track
  const playPrevious = useCallback(() => {
    if (playlist && playlist.tracks) {
      // If current track has played less than 3 seconds, go to previous track
      // Otherwise, restart current track
      const currentTime = audioPlayerRef?.audio?.current?.currentTime || 0;
      
      if (currentTime <= 3) {
        // Go to previous track
        const prevIndex = getPreviousTrackIndex();
        setCurrentTrackIndex(prevIndex);
      } else {
        // Restart current track
        if (audioPlayerRef?.audio?.current) {
          audioPlayerRef.audio.current.currentTime = 0;
          dispatch({ type: 'UPDATE_TRACK_START_TIME', payload: Date.now() });
        }
      }
    }
  }, [playlist, audioPlayerRef, getPreviousTrackIndex, dispatch]);

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
    // Handle repeat single track
    if (state.repeatMode === REPEAT_MODES.TRACK) {
      // Restart the current track
      if (audioPlayerRef?.audio?.current) {
        audioPlayerRef.audio.current.currentTime = 0;
        dispatch({ type: 'UPDATE_TRACK_START_TIME', payload: Date.now() });
        setTimeout(() => {
          audioPlayerRef.audio.current.play().catch(e => console.log('Play prevented:', e));
        }, 50);
      }
      return;
    }
    
    // Handle normal playback or playlist repeat
    // Set a small timeout to ensure state updates properly
    setTimeout(() => {
      // If not on repeat playlist and we're at the last track, just stop
      const isLastTrack = !state.shuffleMode && 
        currentTrackIndex === (playlist?.tracks?.length - 1);
      
      if (isLastTrack && state.repeatMode !== REPEAT_MODES.PLAYLIST) {
        dispatch({ type: 'PAUSE' });
        return;
      }
      
      playNext();
      dispatch({ type: 'PLAY' });
    }, 50);
  }, [playNext, dispatch, state.repeatMode, state.shuffleMode, 
      currentTrackIndex, playlist, audioPlayerRef]);

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
        toggleShuffle,
        cycleRepeatMode,
        setRepeatMode,
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