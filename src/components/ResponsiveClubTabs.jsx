import PropTypes from 'prop-types';
import { useRef, useEffect } from 'react';

// Icons for tabs
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const MembersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const LeaderboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8"></path>
    <path d="M12 9V4"></path>
    <path d="M16 17V8"></path>
    <path d="M8 17V12"></path>
    <circle cx="12" cy="3" r="1"></circle>
    <circle cx="16" cy="7" r="1"></circle>
    <circle cx="8" cy="11" r="1"></circle>
    <circle cx="12" cy="17" r="1"></circle>
    <circle cx="16" cy="17" r="1"></circle>
    <circle cx="8" cy="17" r="1"></circle>
  </svg>
);

const ChallengesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="6"></circle>
    <circle cx="12" cy="12" r="2"></circle>
  </svg>
);

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    marginBottom: '1.5rem',
    overflow: 'hidden',
  },
  scrollArea: {
    position: 'relative',
    width: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  },
  hideScrollbar: {
    '::-webkit-scrollbar': {
      display: 'none',
    },
  },
  tabsList: {
    display: 'flex',
    borderBottom: '1px solid rgba(75, 85, 99, 0.4)',
    width: 'max-content',
    minWidth: '100%',
    margin: 0,
    padding: 0,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    color: '#9CA3AF',
    borderBottom: '2px solid transparent',
    whiteSpace: 'nowrap',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: 'transparent',
    border: 'none',
  },
  tabActive: {
    color: '#3B82F6',
    borderBottomColor: '#3B82F6',
  },
  tabIcon: {
    marginRight: '0.5rem',
  },
  scrollButtons: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    border: 'none',
    cursor: 'pointer',
    zIndex: 10,
  },
  leftButton: {
    left: 0,
    background: 'linear-gradient(to right, rgba(17, 24, 39, 0.9), rgba(17, 24, 39, 0))',
  },
  rightButton: {
    right: 0,
    background: 'linear-gradient(to left, rgba(17, 24, 39, 0.9), rgba(17, 24, 39, 0))',
  },
  scrollIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '2px',
    width: '30%',
    backgroundColor: 'rgba(75, 85, 99, 0.2)',
    transform: 'translateX(0)',
    transition: 'transform 0.2s',
  }
};

export function ResponsiveClubTabs({ activeTab, onTabChange }) {
  const scrollAreaRef = useRef(null);
  const tabsRef = useRef({});
  
  // Add a tab to the refs collection
  const addTabRef = (id, element) => {
    if (element) {
      tabsRef.current[id] = element;
    }
  };
  
  // Scroll to the active tab when it changes
  useEffect(() => {
    if (activeTab && tabsRef.current[activeTab] && scrollAreaRef.current) {
      const tabElement = tabsRef.current[activeTab];
      const scrollArea = scrollAreaRef.current;
      
      // Get the position info
      const tabRect = tabElement.getBoundingClientRect();
      const scrollRect = scrollArea.getBoundingClientRect();
      
      // Calculate how far to scroll to center the tab
      const offset = tabRect.left + scrollArea.scrollLeft - scrollRect.left;
      const centerPosition = offset - (scrollRect.width / 2) + (tabRect.width / 2);
      
      // Smooth scroll to the position
      scrollArea.scrollTo({
        left: centerPosition,
        behavior: 'smooth',
      });
    }
  }, [activeTab]);
  
  // Handle tab changes
  const handleTabClick = (tabId) => {
    if (onTabChange) {
      onTabChange(tabId);
    }
  };
  
  // Scroll the tabs left or right
  const handleScroll = (direction) => {
    if (scrollAreaRef.current) {
      const scrollAmount = scrollAreaRef.current.clientWidth * 0.7;
      const newPosition = 
        direction === 'left' 
          ? scrollAreaRef.current.scrollLeft - scrollAmount 
          : scrollAreaRef.current.scrollLeft + scrollAmount;
          
      scrollAreaRef.current.scrollTo({
        left: newPosition,
        behavior: 'smooth',
      });
    }
  };
  
  // Define the tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <HomeIcon /> },
    { id: 'chat', label: 'Chat', icon: <ChatIcon /> },
    { id: 'members', label: 'Members', icon: <MembersIcon /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <LeaderboardIcon /> },
    { id: 'challenges', label: 'Challenges', icon: <ChallengesIcon /> },
  ];
  
  return (
    <div style={styles.container}>
      {/* Left scroll indicator button */}
      <button 
        style={{...styles.scrollButtons, ...styles.leftButton}}
        onClick={() => handleScroll('left')}
        aria-label="Scroll tabs left"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      
      {/* Scrollable tabs */}
      <div 
        ref={scrollAreaRef} 
        style={{...styles.scrollArea, ...styles.hideScrollbar}}
      >
        <div style={styles.tabsList}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => addTabRef(tab.id, el)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {})
              }}
              onClick={() => handleTabClick(tab.id)}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <span style={styles.tabIcon}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Right scroll indicator button */}
      <button 
        style={{...styles.scrollButtons, ...styles.rightButton}}
        onClick={() => handleScroll('right')}
        aria-label="Scroll tabs right"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  );
}

ResponsiveClubTabs.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
};

export default ResponsiveClubTabs; 