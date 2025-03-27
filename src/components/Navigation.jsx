import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('/');

  useEffect(() => {
    setActiveTab(location.pathname);
  }, [location]);

  const handleNavClick = (path) => {
    navigate(path);
  };

  return (
    <nav className="bottom-navigation">
      <div 
        className={`nav-item ${activeTab === '/' ? 'active' : ''}`}
        onClick={() => handleNavClick('/')}
      >
        <div className="nav-icon">🏠</div>
        <div className="nav-label">Home</div>
      </div>
      
      <div 
        className={`nav-item ${activeTab === '/run' ? 'active' : ''}`}
        onClick={() => handleNavClick('/run')}
      >
        <div className="nav-icon">🏃</div>
        <div className="nav-label">Run</div>
      </div>
      
      <div 
        className={`nav-item ${activeTab === '/history' ? 'active' : ''}`}
        onClick={() => handleNavClick('/history')}
      >
        <div className="nav-icon">📊</div>
        <div className="nav-label">History</div>
      </div>
      
      <div 
        className={`nav-item ${activeTab === '/feed' ? 'active' : ''}`}
        onClick={() => handleNavClick('/feed')}
      >
        <div className="nav-icon">📱</div>
        <div className="nav-label">Feed</div>
      </div>
      
      <div 
        className={`nav-item ${activeTab === '/profile' ? 'active' : ''}`}
        onClick={() => handleNavClick('/profile')}
      >
        <div className="nav-icon">👤</div>
        <div className="nav-label">Profile</div>
      </div>
    </nav>
  );
}; 