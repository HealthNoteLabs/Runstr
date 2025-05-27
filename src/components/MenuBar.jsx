import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FloatingMusicPlayer } from './FloatingMusicPlayer';
import { useActivityMode, ACTIVITY_TYPES } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';
import rewardsPayoutService from '../services/rewardsPayoutService';

export const MenuBar = () => {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, setMode, getActivityText } = useActivityMode();
  const { 
    distanceUnit, toggleDistanceUnit,
    healthEncryptionPref, setHealthEncryptionPref,
    publishMode, setPublishMode,
    privateRelayUrl, setPrivateRelayUrl
  } = useSettings();

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
      name: 'TEAMS', 
      path: '/teams', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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

  const handleActivityModeChange = (newMode) => {
    setMode(newMode);
  };

  const handleHealthEncryptionToggle = async (e) => {
    const enable = e.target.checked;
    if (!enable) {
      const confirmDisable = window.confirm(
        'Publishing health data unencrypted will make the values publicly visible on relays. Are you sure you want to disable encryption?'
      );
      if (!confirmDisable) {
        e.preventDefault();
        return;
      }
    }
    setHealthEncryptionPref(enable ? 'encrypted' : 'plaintext');
  };

  return (
    <div className="w-full">
      {/* Header with Settings */}
      <header className="flex justify-between items-center p-4 w-full">
        <Link to="/" className="text-xl font-bold">#RUNSTR</Link>
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
          <div className="bg-[#1a222e] rounded-t-xl sm:rounded-xl w-full max-w-md p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Settings</h3>
              <button onClick={toggleSettings} className="text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Activity Types Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Activity Types</h4>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  className={`p-3 rounded-lg ${mode === ACTIVITY_TYPES.RUN ? 'bg-indigo-600' : 'bg-[#111827]'} text-white text-center`}
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.RUN)}
                >
                  Run
                </button>
                <button 
                  className={`p-3 rounded-lg ${mode === ACTIVITY_TYPES.WALK ? 'bg-indigo-600' : 'bg-[#111827]'} text-white text-center`}
                  onClick={() => handleActivityModeChange(ACTIVITY_TYPES.WALK)}
                >
                  Walk
                </button>
                <button 
                  className={`p-3 rounded-lg ${mode === ACTIVITY_TYPES.CYCLE ? 'bg-indigo-600' : 'bg-[#111827]'} text-white text-center`}
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
              <p className="text-sm text-gray-400 mt-2">
                All distances will be shown in {distanceUnit === 'km' ? 'kilometers' : 'miles'} throughout the app
              </p>
            </div>
            
            {/* Health Encryption Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Health Data Privacy</h4>
              <div className="flex items-center justify-between bg-[#111827] p-3 rounded-lg mb-3">
                <span className="text-sm text-gray-400 mr-3">Encrypt Health Data (NIP-44)</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id="encryptionToggleModal"
                    checked={healthEncryptionPref === 'encrypted'}
                    onChange={handleHealthEncryptionToggle}
                  />
                  <span className="toggle-slider"></span>
                </div>
              </div>

              {/* Publish Destination Section - ADDED HERE */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Publish Destination</label>
                <div className="flex rounded-md bg-[#111827] p-1 space-x-1">
                  <button
                    className={`flex-1 px-3 py-2 text-xs rounded-md ${
                      publishMode === 'public' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                    }`}
                    onClick={() => setPublishMode('public')}
                  >
                    Public Relays
                  </button>
                  <button
                    className={`flex-1 px-3 py-2 text-xs rounded-md ${
                      publishMode === 'private' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                    }`}
                    onClick={() => setPublishMode('private')}
                  >
                    Private Relay
                  </button>
                  <button
                    className={`flex-1 px-3 py-2 text-xs rounded-md ${
                      publishMode === 'mixed' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'
                    }`}
                    onClick={() => setPublishMode('mixed')}
                  >
                    Mixed
                  </button>
                </div>
                {(publishMode === 'private' || publishMode === 'mixed') && (
                  <div className="mt-2">
                    <label htmlFor="privateRelayUrlInputModal" className="block text-xs font-medium text-gray-400 mb-1">
                      Private Relay URL (wss://...)
                    </label>
                    <input
                      id="privateRelayUrlInputModal"
                      type="text"
                      value={privateRelayUrl}
                      onChange={e => setPrivateRelayUrl(e.target.value)}
                      placeholder="wss://your-private-relay.com"
                      className="w-full bg-[#0b101a] p-2 rounded-md text-white text-sm border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Bitcoin Rewards Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3">Bitcoin Rewards</h4>
              {/*
              <div className="space-y-2">
                <label htmlFor="lnAddressInput" className="text-sm text-gray-400">Lightning Address (to receive streak rewards)</label>
                <div className="flex">
                  <input
                    id="lnAddressInput"
                    type="text"
                    defaultValue={localStorage.getItem('lightningAddress') || ''}
                    placeholder="you@getalby.com"
                    className="flex-1 bg-[#111827] p-2 rounded-l-lg text-white text-sm"
                  />
                  <button
                    className="bg-indigo-600 px-4 rounded-r-lg text-white text-sm"
                    onClick={() => {
                      const val = document.getElementById('lnAddressInput').value.trim();
                      if (val && val.includes('@')) {
                        localStorage.setItem('lightningAddress', val);
                        localStorage.setItem('runstr_lightning_addr', val);
                        alert('Lightning address saved!');
                      } else {
                        alert('Enter a valid Lightning address e.g. name@domain.com');
                      }
                    }}
                  >Save</button>
                </div>
                <p className="text-xs text-gray-500">If you also connect an NWC wallet, the app will pay that first and fall back to this address if needed.</p>
              </div>
              */}
              <p className="text-sm text-gray-400">
                Runstr now automatically sends Bitcoin rewards directly to your connected Nostr account (via Zaps).
                You no longer need to configure a separate Lightning Address here. Ensure your Nostr profile has a Lightning Address set up to receive rewards.
              </p>
              {/* End of debug section – TEST PAYOUT button removed for production */}
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
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0B101A] border-t border-gray-700 flex justify-around items-center h-16 z-40">
        {menuItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`flex flex-col items-center justify-center text-xs font-medium transition-colors duration-150 ease-in-out h-full flex-1 
                        ${location.pathname === item.path ? 'text-indigo-400' : 'text-gray-400 hover:text-indigo-300'}`}
          >
            {item.icon}
            <span className="text-center">{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};
