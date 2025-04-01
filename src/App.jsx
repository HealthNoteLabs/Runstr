import { BrowserRouter as Router } from 'react-router-dom';
import { RunTrackerProvider } from './contexts/RunTrackerContext';
import { DistanceUnitProvider } from './contexts/DistanceUnitContext';
import { RunClubProvider } from './contexts/RunClubContext';
import { ChatProvider } from './contexts/ChatContext';
import { EventProvider } from './contexts/EventContext';
import { MenuBar } from './components/MenuBar';
import { AppRoutes } from './AppRoutes';
import { useEffect } from 'react';

export const App = () => {
  // Set up viewport height for mobile browsers
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    // Set status bar to transparent on Android
    if (window.StatusBar) {
      window.StatusBar.overlaysWebView(true);
      window.StatusBar.backgroundColorByHexString('#1a2237');
      window.StatusBar.styleLightContent();
    }

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  return (
    <Router>
      <RunTrackerProvider>
        <DistanceUnitProvider>
          <RunClubProvider>
            <ChatProvider>
              <EventProvider>
                <div className="min-h-screen bg-[#1a2237] text-white flex flex-col">
                  {/* Status bar spacer for iOS */}
                  <div 
                    className="w-full bg-[#1a2237]" 
                    style={{ height: 'var(--safe-area-inset-top)' }} 
                  />
                  
                  <MenuBar />
                  
                  <main className="flex-1 w-full max-w-[100vw] overflow-x-hidden">
                    <AppRoutes />
                  </main>
                  
                  {/* Bottom safe area spacer */}
                  <div 
                    className="w-full bg-[#1a2237]" 
                    style={{ height: 'var(--safe-area-inset-bottom)' }} 
                  />
                </div>
              </EventProvider>
            </ChatProvider>
          </RunClubProvider>
        </DistanceUnitProvider>
      </RunTrackerProvider>
    </Router>
  );
};
