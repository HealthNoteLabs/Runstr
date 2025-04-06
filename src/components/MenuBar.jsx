import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FloatingMusicPlayer } from './FloatingMusicPlayer';
import { useActivityType } from '../contexts/ActivityTypeContext';

export const MenuBar = () => {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { activityType, setActivityType } = useActivityType();
  const [distanceUnit, setDistanceUnit] = useState(
    () => localStorage.getItem('distanceUnit') || 'km'
  );

  // Get the appropriate display name for the header based on activity type
  const getAppName = () => {
    if (activityType === 'walk') {
      return '#WALKSTR';
    } else if (activityType === 'cycle') {
      return '#CYCLESTR';
    } else {
      return '#RUNSTR';
    }
  };

  const menuItems = [
    { 
      name: 'DASHBOARD', 
      path: '/', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ) 
    },
    { 
      name: 'STATS', 
      path: '/history', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ) 
    },
    { 
      name: 'FEED', 
      path: '/club', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      ) 
    },
    { 
      name: 'MUSIC', 
      path: '/music', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      ) 
    }
  ];

  const toggleSettings = () => {
    setSettingsOpen(!settingsOpen);
  };

  const toggleDistanceUnit = () => {
    const newUnit = distanceUnit === 'km' ? 'mi' : 'km';
    setDistanceUnit(newUnit);
    localStorage.setItem('distanceUnit', newUnit);
  };

  return (
    <div className="w-full">
      {/* Header with Settings */}
      <header className="flex justify-between items-center p-4 w-full max-w-[375px] mx-auto">
        <Link to="/" className="text-xl font-bold">{getAppName()}</Link>
        <div className="min-w-[120px]">
          <FloatingMusicPlayer />
        </div>
        <button className="text-gray-400" onClick={toggleSettings}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black bg-opacity-70">
          <div className="bg-[#1a222e] rounded-t-xl sm:rounded-xl w-full max-w-md p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Settings</h3>
              <button onClick={toggleSettings} className="text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Activity Type Toggles */}
            <div className="mb-6">
              <h4 className="text-md font-semibold mb-3">Activity Type</h4>
              <div className="grid grid-cols-3 gap-2">
                <button
                  className={`p-3 rounded-lg flex flex-col items-center justify-center text-sm ${
                    activityType === 'run' ? 'bg-indigo-600 text-white' : 'bg-[#111827] text-gray-300'
                  }`}
                  onClick={() => setActivityType('run')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Run
                </button>
                <button
                  className={`p-3 rounded-lg flex flex-col items-center justify-center text-sm ${
                    activityType === 'walk' ? 'bg-indigo-600 text-white' : 'bg-[#111827] text-gray-300'
                  }`}
                  onClick={() => setActivityType('walk')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2h2m3-4H9a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-1m-1 4l-3 3m0 0l-3-3m3 3V3" />
                  </svg>
                  Walk
                </button>
                <button
                  className={`p-3 rounded-lg flex flex-col items-center justify-center text-sm ${
                    activityType === 'cycle' ? 'bg-indigo-600 text-white' : 'bg-[#111827] text-gray-300'
                  }`}
                  onClick={() => setActivityType('cycle')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Cycle
                </button>
              </div>
            </div>
            
            {/* Distance Unit Toggle */}
            <div className="mb-6">
              <h4 className="text-md font-semibold mb-3">Distance Unit</h4>
              <div className="flex justify-center">
                <div className="flex rounded-full bg-[#111827] p-1">
                  <button 
                    className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'km' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
                    onClick={() => distanceUnit !== 'km' && toggleDistanceUnit()}
                  >
                    Kilometers
                  </button>
                  <button 
                    className={`px-6 py-2 rounded-full text-sm ${distanceUnit === 'mi' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
                    onClick={() => distanceUnit !== 'mi' && toggleDistanceUnit()}
                  >
                    Miles
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col space-y-4">
              <Link 
                to="/nwc" 
                className="flex items-center p-3 bg-[#111827] rounded-lg text-white"
                onClick={toggleSettings}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Wallet</span>
              </Link>
              <Link 
                to="/about" 
                className="flex items-center p-3 bg-[#111827] rounded-lg text-white"
                onClick={toggleSettings}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>About Runstr</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around items-center bg-[#111827] border-t border-gray-800 py-4 max-w-[375px] mx-auto z-30">
        {menuItems.map((item) => (
          <Link 
            key={item.name} 
            to={item.path} 
            className={`flex flex-col items-center text-xs ${location.pathname === item.path ? 'text-gray-300' : 'text-gray-500'}`}
          >
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};
