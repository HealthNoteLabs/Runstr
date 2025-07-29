import { useContext, useState, useEffect } from 'react';
import { useActivityMode, ACTIVITY_TYPES } from '../contexts/ActivityModeContext';
import { useSettings } from '../contexts/SettingsContext';
import { getWorkoutAssociations } from '../utils/teamChallengeHelper';

export const ActivityModeBanner = ({ onSettingsClick }) => {
  const { mode, setMode, getActivityText } = useActivityMode();
  const { distanceUnit, toggleDistanceUnit } = useSettings();
  const [teamInfo, setTeamInfo] = useState(null);

  // Fetch team information when component mounts
  useEffect(() => {
    const fetchTeamInfo = async () => {
      try {
        const associations = await getWorkoutAssociations();
        setTeamInfo(associations.teamAssociation);
      } catch (error) {
        console.warn('ActivityModeBanner: Error fetching team associations:', error);
        setTeamInfo(null);
      }
    };

    fetchTeamInfo();
  }, []);

  const activityModes = [
    { 
      mode: ACTIVITY_TYPES.RUN, 
      label: 'RUNSTR'
    },
    { 
      mode: ACTIVITY_TYPES.WALK, 
      label: 'WALKSTR'
    },
    { 
      mode: ACTIVITY_TYPES.CYCLE, 
      label: 'CYCLESTR'
    }
  ];

  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  const handleDistanceUnitToggle = () => {
    toggleDistanceUnit();
  };

  return (
    <div className="dashboard-wallet-header">
      <div className="wallet-card">
        {/* Team Display */}
        {teamInfo && teamInfo.teamName && (
          <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" style={{height: '14px', width: '14px'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Team: {teamInfo.teamName}</span>
          </div>
        )}
        <div className="wallet-actions" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '8px',
          padding: '12px 16px'
        }}>
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            {activityModes.map((activity) => (
              <button
                key={activity.mode}
                className={`action-button ${mode === activity.mode ? 'active' : ''}`}
                onClick={() => handleModeChange(activity.mode)}
                style={{
                  backgroundColor: mode === activity.mode ? '#ffffff' : '#000000',
                  color: mode === activity.mode ? '#000000' : '#ffffff',
                  border: `1px solid ${mode === activity.mode ? '#ffffff' : 'var(--border-color)'}`,
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  minWidth: '65px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  flex: 1
                }}
                title={`Switch to ${activity.label} mode`}
              >
                {activity.label}
              </button>
            ))}
          </div>
          
          {/* Settings Button */}
          <button 
            className="text-text-secondary hover:text-text-primary transition-colors duration-normal" 
            onClick={onSettingsClick}
            style={{
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              height: '40px'
            }}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}; 