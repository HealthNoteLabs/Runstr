import React from 'react';
import { useLeagueLeaderboard } from '../hooks/useLeagueLeaderboard';

export const LeagueDebugTest = () => {
  console.log('🔍 LeagueDebugTest: Component is rendering');
  
  // Test the hook
  let hookResult = null;
  let hookError = null;
  
  try {
    hookResult = useLeagueLeaderboard();
    console.log('🔍 useLeagueLeaderboard hook result:', hookResult);
  } catch (error) {
    hookError = error;
    console.error('🔍 useLeagueLeaderboard hook error:', error);
  }
  
  return (
    <div style={{ 
      backgroundColor: '#ff0000', 
      color: 'white', 
      padding: '2rem', 
      margin: '1rem',
      border: '4px solid #ffff00',
      borderRadius: '8px',
      minHeight: '300px'
    }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '1rem' }}>
        🚨 DEBUG: League Hook Test
      </h1>
      
      <div style={{ backgroundColor: '#0066cc', padding: '1rem', borderRadius: '4px', margin: '1rem 0' }}>
        <p style={{ fontWeight: 'bold' }}>Hook Test Results:</p>
        {hookError ? (
          <div style={{ color: '#ff6666' }}>
            <p>❌ Hook Error: {hookError.message}</p>
            <pre style={{ fontSize: '12px', marginTop: '0.5rem' }}>
              {hookError.stack}
            </pre>
          </div>
        ) : (
          <div style={{ color: '#66ff66' }}>
            <p>✅ Hook loaded successfully</p>
            <p>Loading: {hookResult?.isLoading ? 'true' : 'false'}</p>
            <p>Error: {hookResult?.error || 'none'}</p>
            <p>Leaderboard length: {hookResult?.leaderboard?.length || 0}</p>
            <p>Activity mode: {hookResult?.activityMode || 'unknown'}</p>
          </div>
        )}
      </div>
      
      <button 
        onClick={() => {
          console.log('🔍 Full hook result:', hookResult);
          console.log('🔍 Browser console should show details above');
        }}
        style={{
          backgroundColor: '#ffff00',
          color: '#000000',
          padding: '0.5rem 1rem',
          border: 'none',
          borderRadius: '4px',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        🔧 Log Hook Details
      </button>
    </div>
  );
};

export default LeagueDebugTest; 