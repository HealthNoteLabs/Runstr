export const checkOnlineStatus = () => {
  return navigator.onLine;
};

export const storeRunLocally = (runData) => {
  const storedRuns = JSON.parse(localStorage.getItem('offlineRuns') || '[]');
  storedRuns.push(runData);
  localStorage.setItem('offlineRuns', JSON.stringify(storedRuns));
};

export const syncOfflineRuns = () => {
  const offlineRuns = JSON.parse(localStorage.getItem('offlineRuns') || '[]');
  if (offlineRuns.length > 0 && navigator.onLine) {
    // Sync with server when implemented
    localStorage.removeItem('offlineRuns');
  }
};
