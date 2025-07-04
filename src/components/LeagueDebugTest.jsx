import React from 'react';

export const LeagueDebugTest = () => {
  console.log('🔍 LeagueDebugTest: Component is rendering');
  
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
        🚨 DEBUG: League Component Test
      </h1>
      <p>✅ React import: Working</p>
      <p>✅ Component export: Working</p>
      <p>✅ JSX rendering: Working</p>
      <p>✅ Inline styles: Working</p>
      <p>✅ Basic component structure: Working</p>
      
      <div style={{ backgroundColor: '#0066cc', padding: '1rem', borderRadius: '4px', margin: '1rem 0' }}>
        <p style={{ fontWeight: 'bold' }}>If you can see this red box:</p>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>✅ Component mounting works</li>
          <li>✅ Route configuration works</li>
          <li>✅ Basic rendering works</li>
        </ul>
      </div>
      
      <button 
        onClick={() => {
          console.log('🔍 Button clicked - testing event handlers');
          alert('Debug button works! The issue is NOT with basic React functionality.');
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
        🔧 Test Button
      </button>
    </div>
  );
};

export default LeagueDebugTest; 