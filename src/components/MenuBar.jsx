import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FloatingMusicPlayer } from './FloatingMusicPlayer';
import { useActivityMode, ACTIVITY_TYPES } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';
import BottomSheet from './ui/BottomSheet';
import { vibrate } from '../utils/platform';
import { Settings, Home, BarChart2, MessageSquare, Users, Music } from 'lucide-react';
import { useEffect } from 'react';

export const MenuBar = () => {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, setMode, getActivityText } = useActivityMode();
  const { distanceUnit, toggleDistanceUnit } = useSettings();

  // Add the styles for safe area and bottom padding
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      body {
        padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
      }
      
      .h-safe-area-bottom {
        height: env(safe-area-inset-bottom, 0px);
      }
      
      .touch-manipulation {
        touch-action: manipulation;
      }
    `;
    
    // Append to head
    document.head.appendChild(styleEl);
    
    // Clean up on unmount
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  const menuItems = [
    { 
      name: 'HOME', 
      path: '/', 
      icon: <Home className="h-6 w-6 mb-1" />
    },
    { 
      name: 'STATS', 
      path: '/history', 
      icon: <BarChart2 className="h-6 w-6 mb-1" />
    },
    { 
      name: 'FEED', 
      path: '/club', 
      icon: <MessageSquare className="h-6 w-6 mb-1" />
    },
    { 
      name: 'TEAMS', 
      path: '/teams', 
      icon: <Users className="h-6 w-6 mb-1" />
    },
    { 
      name: 'MUSIC', 
      path: '/music', 
      icon: <Music className="h-6 w-6 mb-1" />
    }
  ];

  const toggleSettings = () => {
    vibrate('light');
    setSettingsOpen(!settingsOpen);
  };

  const handleActivityModeChange = (newMode) => {
    if (newMode !== mode) {
      vibrate('medium');
    }
    setMode(newMode);
  };
  
  const handleDistanceUnitChange = () => {
    vibrate('medium');
    toggleDistanceUnit();
  };
  
  const handleLinkClick = () => {
    vibrate('light');
    // Close settings sheet if open
    if (settingsOpen) {
      setSettingsOpen(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header with Settings */}
      <header className="flex justify-between items-center p-4 w-full">
        <Link 
          to="/" 
          className="text-xl font-bold"
          onClick={handleLinkClick}
        >
          #RUNSTR
        </Link>
        <div className="min-w-[120px]">
          <FloatingMusicPlayer />
        </div>
        <button 
          className="text-gray-400 p-2 rounded-full active:bg-gray-700 touch-manipulation"
          onClick={toggleSettings}
          aria-label="Settings"
        >
          <Settings className="h-6 w-6" />
        </button>
      </header>

      {/* Settings BottomSheet */}
      <BottomSheet
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        height="75%"
        title="Settings"
        showDragHandle={true}
      >
        <div className="settings-content p-4">
          {/* Activity Types Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-3">Activity Types</h4>
            <div className="grid grid-cols-3 gap-2">
              <button 
                className={`p-4 rounded-lg ${mode === ACTIVITY_TYPES.RUN ? 'bg-indigo-600' : 'bg-[#111827]'} text-white text-center touch-manipulation`}
                onClick={() => handleActivityModeChange(ACTIVITY_TYPES.RUN)}
              >
                Run
              </button>
              <button 
                className={`p-4 rounded-lg ${mode === ACTIVITY_TYPES.WALK ? 'bg-indigo-600' : 'bg-[#111827]'} text-white text-center touch-manipulation`}
                onClick={() => handleActivityModeChange(ACTIVITY_TYPES.WALK)}
              >
                Walk
              </button>
              <button 
                className={`p-4 rounded-lg ${mode === ACTIVITY_TYPES.CYCLE ? 'bg-indigo-600' : 'bg-[#111827]'} text-white text-center touch-manipulation`}
                onClick={() => handleActivityModeChange(ACTIVITY_TYPES.CYCLE)}
              >
                Cycle
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Currently tracking: {getActivityText()}
            </p>
          </div>
          
          {/* Distance Unit Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-3">Distance Units</h4>
            <div className="flex justify-center mb-2">
              <div className="flex rounded-full bg-[#111827] p-1">
                <button 
                  className={`px-6 py-3 rounded-full text-sm ${distanceUnit === 'km' ? 'bg-indigo-600 text-white' : 'text-gray-400'} touch-manipulation`}
                  onClick={() => distanceUnit !== 'km' && handleDistanceUnitChange()}
                >
                  Kilometers
                </button>
                <button 
                  className={`px-6 py-3 rounded-full text-sm ${distanceUnit === 'mi' ? 'bg-indigo-600 text-white' : 'text-gray-400'} touch-manipulation`}
                  onClick={() => distanceUnit !== 'mi' && handleDistanceUnitChange()}
                >
                  Miles
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              All distances will be shown in {distanceUnit === 'km' ? 'kilometers' : 'miles'} throughout the app
            </p>
          </div>
          
          <div className="flex flex-col space-y-4">
            <Link 
              to="/nwc" 
              className="flex items-center p-4 bg-[#111827] rounded-lg text-white active:bg-gray-700 touch-manipulation"
              onClick={handleLinkClick}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>Wallet</span>
            </Link>
            <Link 
              to="/about" 
              className="flex items-center p-4 bg-[#111827] rounded-lg text-white active:bg-gray-700 touch-manipulation"
              onClick={handleLinkClick}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>About Runstr</span>
            </Link>
          </div>
        </div>
      </BottomSheet>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#0a1525] py-2 z-40 border-t border-gray-800">
        <div className="max-w-[500px] mx-auto">
          <ul className="flex justify-around">
            {menuItems.map((item) => (
              <li key={item.name} className="text-center">
                <Link 
                  to={item.path} 
                  className={`flex flex-col items-center px-3 py-2 rounded-md ${location.pathname === item.path ? 'text-indigo-400' : 'text-gray-400'} touch-manipulation`}
                  onClick={handleLinkClick}
                >
                  {item.icon}
                  <span className="text-xs font-medium tracking-wider">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Safe area spacing for notched phones */}
        <div className="h-safe-area-bottom"></div>
      </nav>
    </div>
  );
};
