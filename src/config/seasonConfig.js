export const SEASON_1_CONFIG = {
  id: "RUNSTR_SEASON_1",
  name: "RUNSTR Season 1",
  description: "3-month distance competition - most total distance wins",
  // Season dates will be configured later
  startDate: null,
  endDate: null,
  seasonPassPrice: 10000, // sats
  rules: "Most total distance wins",
  maxLeaderboardSize: 50,
  
  // Competition settings
  competitionType: "distance", // vs "completion"
  showCompletionPercentage: false,
  showDistanceRanking: true,
  
  // UI Configuration
  displaySettings: {
    showProgressBars: false,
    showMileMarkers: false,
    showFinishLine: false,
    focusOnRanking: true
  }
};

// Activity-specific configurations
export const getSeasonTitle = (activityMode) => {
  switch (activityMode) {
    case 'run':
      return 'RUNSTR Season 1';
    case 'walk':
      return 'WALKSTR Season 1';
    case 'cycle':
      return 'CYCLESTR Season 1';
    default:
      return 'RUNSTR Season 1';
  }
};

export const getActivityText = (count, activityMode) => {
  switch (activityMode) {
    case 'run':
      return `${count} run${count !== 1 ? 's' : ''}`;
    case 'walk':
      return `${count} walk${count !== 1 ? 's' : ''}`;
    case 'cycle':
      return `${count} ride${count !== 1 ? 's' : ''}`;
    default:
      return `${count} run${count !== 1 ? 's' : ''}`;
  }
}; 