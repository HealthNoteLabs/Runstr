import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const FloatingMusicPlayer = () => {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    playNext, 
    playPrevious
  } = useAudioPlayer();
  
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  
  if (!currentTrack) return <span></span>;

  return (
    <div className={`${expanded ? 'header-player-expanded' : 'header-player-collapsed'}`}>
      {expanded ? (
        <div className="absolute top-12 right-0 left-0 bg-[#1a222e] shadow-lg rounded-b-lg z-40 p-3">
          <div className="flex justify-between items-center mb-2">
            <button onClick={() => setExpanded(false)} className="text-xs text-gray-400">
              ▼ Minimize
            </button>
            <button onClick={() => navigate('/music')} className="text-xs text-blue-400">
              Go to Music
            </button>
          </div>
          <div className="mb-2">
            <p className="text-sm font-medium truncate">{currentTrack.title}</p>
            <p className="text-xs text-gray-400 truncate">{currentTrack.artist || 'Unknown Artist'}</p>
          </div>
          <div className="flex justify-center space-x-8">
            <button onClick={playPrevious} className="text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button onClick={togglePlayPause} className="text-gray-300">
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
            <button onClick={playNext} className="text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center cursor-pointer" onClick={() => setExpanded(true)}>
          <span className="flex items-center justify-center mr-2">
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </span>
          <span className="text-sm truncate">{currentTrack.title}</span>
        </div>
      )}
    </div>
  );
} 