export const SEASON_1_CONFIG = {
  id: "RUNSTR_SEASON_1",
  name: "RUNSTR Season 1",
  description: "3-month distance competition - Most miles wins!",
  startDate: "2025-02-01T00:00:00Z",
  endDate: "2025-05-01T23:59:59Z", 
  seasonPassPrice: 10000, // sats (10k sats = ~$10 at current rates)
  rules: "Most total distance wins",
  maxParticipants: null, // unlimited
  
  // NWC connection for receiving season pass payments
  nwcConnectionString: "nostr+walletconnect://ba80990666ef0b6f4ba5059347beb13242921e54669e680064ca755256a1e3a6?relay=wss%3A%2F%2Frelay.coinos.io&secret=975686fcf2632af13e263013337d6ee76747e85c5ead6863d6897c1c199ee0da&lud16=RUNSTR@coinos.io",
  
  // LocalStorage keys
  storageKeys: {
    participants: 'runstr_season1_participants',
    userStatus: 'runstr_season1_user_status',
    lastUpdated: 'runstr_season1_last_updated'
  },

  // Feature flags
  features: {
    participantOnlyFeed: true,
    participantOnlyLeaderboard: true,
    seasonPassRequired: true
  }
};

// Helper to check if season is active
export const isSeasonActive = () => {
  const now = new Date().toISOString();
  return now >= SEASON_1_CONFIG.startDate && now <= SEASON_1_CONFIG.endDate;
};

// Helper to get days remaining in season
export const getDaysRemaining = () => {
  const now = new Date();
  const endDate = new Date(SEASON_1_CONFIG.endDate);
  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

// Helper to format season pass price
export const formatSeasonPassPrice = () => {
  return `${(SEASON_1_CONFIG.seasonPassPrice / 1000).toFixed(0)}k sats`;
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