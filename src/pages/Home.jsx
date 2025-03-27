import { useEffect } from 'react';
import { useRunProfile } from '../hooks/useRunProfile';

export const Home = () => {
  const { profile } = useRunProfile();

  useEffect(() => {
    // Any initialization code would go here
    console.log('Home page loaded');
  }, []);

  return (
    <div className="home-page">
      <div className="welcome-section">
        <h1>Welcome to Runstr</h1>
        {profile?.name && (
          <p>Hello, {profile.name}!</p>
        )}
      </div>
      
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
          <a href="/run" className="action-button">
            Start Run
          </a>
          <a href="/history" className="action-button">
            View History
          </a>
          <a href="/feed" className="action-button">
            Feed
          </a>
        </div>
      </div>
    </div>
  );
}; 