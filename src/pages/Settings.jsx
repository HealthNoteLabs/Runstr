import React, { useState, useEffect, useContext } from 'react';
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useSettings } from '../contexts/SettingsContext';
import { saveLeaderboardParticipation, getLeaderboardParticipation } from '../utils/leaderboardUtils';
import { getRewardsSettings, saveRewardsSettings } from '../utils/rewardsSettings';
import { Link } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext';
import { fetchRunDataFromWatch, mapWatchDataToRun } from '../services/BluetoothService';
import { SyncConfirmationModal } from '../components/modals/SyncConfirmationModal';
import { testConnection } from '../lib/blossom';

const Settings = () => {
  const { 
    distanceUnit, 
    setDistanceUnit,
    setIsMetric,
    calorieIntensityPref,
    setCalorieIntensityPref,
    healthEncryptionPref,
    setHealthEncryptionPref,
    publishMode,
    setPublishMode,
    privateRelayUrl,
    setPrivateRelayUrl,
    blossomEndpoint,
    setBlossomEndpoint,
    autoPostToNostr,
    setAutoPostToNostr,
    // skipStartCountdown,
    // setSkipStartCountdown,
    // skipEndCountdown,
    // setSkipEndCountdown
  } = useSettings();
  const { publicKey } = useContext(NostrContext);
  
  const [showPaceInMinutes, setShowPaceInMinutes] = useState(true);
  const [autoSaveRuns, setAutoSaveRuns] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [showNotifications, setShowNotifications] = useState(true);
  const [leaderboardParticipation, setLeaderboardParticipation] = useState(true);
  const [autoClaimRewards, setAutoClaimRewards] = useState(false);
  const [rewardsEnabled, setRewardsEnabled] = useState(true);
  const [isSyncingWatch, setIsSyncingWatch] = useState(false);
  const [syncedRun, setSyncedRun] = useState(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // Blossom connection test state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  
  // Load settings from localStorage
  useEffect(() => {
    try {
      // Load standard settings
      const savedPaceSetting = localStorage.getItem('showPaceInMinutes');
      if (savedPaceSetting !== null) {
        setShowPaceInMinutes(JSON.parse(savedPaceSetting));
      }
      
      const savedAutoSave = localStorage.getItem('autoSaveRuns');
      if (savedAutoSave !== null) {
        setAutoSaveRuns(JSON.parse(savedAutoSave));
      }
      
      const savedDarkMode = localStorage.getItem('darkMode');
      if (savedDarkMode !== null) {
        setDarkMode(JSON.parse(savedDarkMode));
      }
      
      const savedNotifications = localStorage.getItem('showNotifications');
      if (savedNotifications !== null) {
        setShowNotifications(JSON.parse(savedNotifications));
      }
      
      // Load leaderboard participation
      setLeaderboardParticipation(getLeaderboardParticipation());
      
      // Load rewards settings
      const rewardsSettings = getRewardsSettings();
      setRewardsEnabled(rewardsSettings.enabled);
      setAutoClaimRewards(rewardsSettings.autoClaimRewards);
      
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);
  
  // Save pace setting to localStorage
  const handlePaceToggle = (e) => {
    const value = e.target.checked;
    setShowPaceInMinutes(value);
    localStorage.setItem('showPaceInMinutes', JSON.stringify(value));
  };
  
  // Handle distance unit changes
  const handleDistanceUnitChange = (unit) => {
    setDistanceUnit(unit);
    setIsMetric(unit === 'km');
  };
  
  // Save auto-save setting to localStorage
  const handleAutoSaveToggle = (e) => {
    const value = e.target.checked;
    setAutoSaveRuns(value);
    localStorage.setItem('autoSaveRuns', JSON.stringify(value));
  };
  
  // Save dark mode setting to localStorage
  const handleDarkModeToggle = (e) => {
    const value = e.target.checked;
    setDarkMode(value);
    localStorage.setItem('darkMode', JSON.stringify(value));
    
    // Apply dark mode to the body element
    if (value) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };
  
  // Save notifications setting to localStorage
  const handleNotificationsToggle = (e) => {
    const value = e.target.checked;
    setShowNotifications(value);
    localStorage.setItem('showNotifications', JSON.stringify(value));
  };
  
  // Save leaderboard participation setting
  const handleLeaderboardToggle = (e) => {
    const value = e.target.checked;
    setLeaderboardParticipation(value);
    saveLeaderboardParticipation(value);
  };
  
  // Save rewards settings
  const handleRewardsEnabledToggle = (e) => {
    const value = e.target.checked;
    setRewardsEnabled(value);
    saveRewardsSettings({
      enabled: value,
      autoClaimRewards,
      showNotifications
    });
  };
  
  // Save auto-claim rewards setting
  const handleAutoClaimToggle = (e) => {
    const value = e.target.checked;
    setAutoClaimRewards(value);
    saveRewardsSettings({
      enabled: rewardsEnabled,
      autoClaimRewards: value,
      showNotifications
    });
  };

  const handleSyncFromWatch = async () => {
    try {
      setIsSyncingWatch(true);
      const rawData = await fetchRunDataFromWatch();
      const mappedRun = mapWatchDataToRun(rawData, distanceUnit);
      setSyncedRun(mappedRun);
      setShowSyncModal(true);
    } catch (err) {
      console.error('Failed to sync from watch:', err);
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(err.message || 'Failed to sync from watch');
      } else {
        alert(err.message || 'Failed to sync from watch');
      }
    } finally {
      setIsSyncingWatch(false);
    }
  };

  const handleCalorieIntensityChange = (preference) => {
    setCalorieIntensityPref(preference);
  };
  
  const handleHealthEncryptionToggle = async (e) => {
    const enable = e.target.checked;
    if (!enable) {
      const confirmDisable = window.confirm(
        'Publishing health data unencrypted will make the values publicly visible on relays. Are you sure you want to disable encryption?'
      );
      if (!confirmDisable) {
        // Revert toggle
        e.preventDefault();
        return;
      }
    }
    setHealthEncryptionPref(enable ? 'encrypted' : 'plaintext');
  };

  const handleAutoPostToggle = (e) => {
    const value = e.target.checked;
    setAutoPostToNostr(value);
  };

  const handleTestBlossomConnection = async () => {
    if (!blossomEndpoint) {
      setConnectionStatus({ success: false, message: 'Please enter a Blossom server URL first' });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const isConnected = await testConnection(blossomEndpoint);
      if (isConnected) {
        setConnectionStatus({ 
          success: true, 
          message: 'Successfully connected to Blossom server!' 
        });
      } else {
        setConnectionStatus({ 
          success: false, 
          message: 'Could not connect to Blossom server. Please check the URL.' 
        });
      }
    } catch (error) {
      setConnectionStatus({ 
        success: false, 
        message: `Connection failed: ${error.message}` 
      });
    } finally {
      setIsTestingConnection(false);
      // Clear status after 5 seconds
      setTimeout(() => setConnectionStatus(null), 5000);
    }
  };

  return (
    <div className="settings-page">
      <h2 className="page-title">Settings</h2>
      
      <div className="settings-section">
        <h3 className="section-heading">Display Settings</h3>
        
        <div className="setting-item">
          <label>Distance Units</label>
          <ButtonGroup
            value={distanceUnit}
            onValueChange={handleDistanceUnitChange}
            options={[
              { value: 'km', label: 'Kilometers' },
              { value: 'mi', label: 'Miles' }
            ]}
            size="default"
          />
        </div>
        
        <div className="setting-item">
          <label htmlFor="paceToggle">Show Pace in Minutes</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="paceToggle"
              checked={showPaceInMinutes}
              onChange={handlePaceToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="darkModeToggle">Dark Mode</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="darkModeToggle"
              checked={darkMode}
              onChange={handleDarkModeToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="encryptionToggle">Encrypt Health Data (NIP-44)</label>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="encryptionToggle"
              checked={healthEncryptionPref === 'encrypted'}
              onChange={handleHealthEncryptionToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label>Publish Destination</label>
          <ButtonGroup
            value={publishMode}
            onValueChange={setPublishMode}
            options={[
              { value: 'public', label: 'Public Relays' },
              { value: 'private', label: 'Private Relay' },
              { value: 'mixed', label: 'Mixed' }
            ]}
            size="default"
          />
          {publishMode !== 'public' && (
            <div className="mt-2">
              {publishMode !== 'blossom' && (
                <>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Private Relay URL</label>
                  <input
                    type="text"
                    value={privateRelayUrl}
                    onChange={e => setPrivateRelayUrl(e.target.value)}
                    placeholder="wss://your-relay.example.com"
                    className="w-full bg-bg-tertiary p-2 rounded-md text-text-primary border border-border-secondary focus:ring-primary focus:border-border-focus outline-none"
                  />
                </>
              )}
              {/* Blossom endpoint is stored for export feature */}
              {publishMode === 'blossom' && (
                <>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Blossom Endpoint</label>
                  <input
                    type="text"
                    value={blossomEndpoint}
                    onChange={e => setBlossomEndpoint(e.target.value)}
                    placeholder="https://cdn.satellite.earth"
                    className="w-full bg-bg-tertiary p-2 rounded-md text-text-primary border border-border-secondary focus:ring-primary focus:border-border-focus outline-none"
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="settings-section">
        <h3 className="section-heading">App Behavior</h3>
        
        <div className="setting-item">
          <label htmlFor="autoSaveToggle">Auto-save Runs</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="autoSaveToggle"
              checked={autoSaveRuns}
              onChange={handleAutoSaveToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="notificationsToggle">Show Notifications</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="notificationsToggle"
              checked={showNotifications}
              onChange={handleNotificationsToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>

        <div className="setting-item">
          <label htmlFor="autoPostToggle">Auto-post Workouts to Nostr</label>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="autoPostToggle"
              checked={autoPostToNostr}
              onChange={handleAutoPostToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>

        <div className="setting-item">
          <label>Workout Extras Publishing (Calories/Intensity)</label>
          <ButtonGroup
            value={calorieIntensityPref}
            onValueChange={handleCalorieIntensityChange}
            options={[
              { value: 'autoAccept', label: 'Auto-Accept' },
              { value: 'manual', label: 'Manual' },
              { value: 'autoIgnore', label: 'Auto-Ignore' }
            ]}
            size="default"
          />
          <p className="setting-description">
            Choose how to handle publishing workout intensity and caloric data to Nostr.
          </p>
        </div>
      </div>
      
      <div className="settings-section">
        <h3 className="section-heading">Leaderboards & Rewards</h3>
        
        <div className="setting-item">
          <label htmlFor="leaderboardToggle">Participate in Leaderboards</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="leaderboardToggle"
              checked={leaderboardParticipation}
              onChange={handleLeaderboardToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="rewardsToggle">Enable Bitcoin Rewards</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="rewardsToggle"
              checked={rewardsEnabled}
              onChange={handleRewardsEnabledToggle}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
        
        <div className="setting-item">
          <label htmlFor="autoClaimToggle">Auto-claim Streak Rewards</label>
          <div className="toggle-switch">
            <input 
              type="checkbox"
              id="autoClaimToggle"
              checked={autoClaimRewards}
              onChange={handleAutoClaimToggle}
              disabled={!rewardsEnabled}
            />
            <span className="toggle-slider"></span>
          </div>
          <p className="setting-description">
            When enabled, streak rewards will be automatically claimed when you reach milestones.
          </p>
        </div>
      </div>
      
      <div className="settings-section">
        <h3 className="section-heading">About</h3>
        <p>Runstr App Version 1.1.0</p>
        <p>A Bitcoin-powered running app</p>
      </div>

      <div className="settings-section">
        <h3 className="section-heading">Music Server</h3>
        <div className="setting-item">
          <label>Blossom Music Server URL</label>
          <input
            type="text"
            value={blossomEndpoint}
            onChange={e => setBlossomEndpoint(e.target.value)}
            placeholder="https://cdn.satellite.earth"
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <Button 
              onClick={handleTestBlossomConnection}
              disabled={isTestingConnection || !blossomEndpoint}
              size="sm"
              variant="default"
            >
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
            {connectionStatus && (
              <span className={connectionStatus.success ? 'text-green-400' : 'text-red-400'}>
                {connectionStatus.message}
              </span>
            )}
          </div>
          <p className="setting-description">
            Connect to your personal Blossom server to access your music library. Leave empty to disable music server integration.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-heading">Integrations</h3>
        <div className="setting-item">
          <label>Bangle.js</label>
          <Button 
            onClick={handleSyncFromWatch} 
            variant="default"
            size="default"
            disabled={isSyncingWatch}
          >
            {isSyncingWatch ? 'Syncing...' : 'Sync Watch'}
          </Button>
        </div>
      </div>

      <SyncConfirmationModal
        isOpen={showSyncModal}
        onClose={() => { setShowSyncModal(false); setSyncedRun(null); }}
        run={syncedRun}
        distanceUnit={distanceUnit}
        publicKey={publicKey}
      />
    </div>
  );
};

export default Settings; 