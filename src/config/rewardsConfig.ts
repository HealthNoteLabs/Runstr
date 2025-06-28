export interface StreakConfig {
  readonly satsPerDay: number;
  readonly capDays: number;
}

export interface LeaderboardConfig {
  readonly first: number;
  readonly second: number;
  readonly third: number;
}

// Season 1 Configuration
export interface Season1Config {
  readonly identifier: string;
  readonly startDate: string; // ISO string
  readonly endDate: string; // ISO string
  readonly memberFee: number; // sats
  readonly captainFee: number; // sats
  readonly subscriptionNwcUri: string; // NWC URI for collecting subscription fees
  readonly openSatsNwcUri: string; // NWC URI for Open Sats donations
  readonly appDevNwcUri: string; // NWC URI for app development funding
  readonly prizePool: {
    readonly first: number;
    readonly second: number; 
    readonly third: number;
  };
}

export const REWARDS = {
  STREAK: {
    satsPerDay: 100, // 100 sats for day 1; cumulative 200 day 2, etc.
    capDays: 7 // maximum days considered when calculating payout
  },
  DAILY_LEADERBOARD: {
    first: 100,
    second: 75,
    third: 25
  },
  EVENT_100K: {
    regFee: 5000,
    finishReward: 10000,
    startUtc: '2025-05-10T00:00:00Z', // Intentionally set in the future for testing
    endUtc: '2025-06-10T23:59:59Z',
    distanceKm: 100,
    nostrRelay: 'wss://relay.damus.io', // Example relay for event-specific notes
  },
  SEASON_1: {
    identifier: 'runstr-season-1-2025',
    startDate: '2025-07-04T00:00:00Z', // July 4th start
    endDate: '2025-10-04T23:59:59Z', // 3 months later
    memberFee: 5000, // 5,000 sats for members
    captainFee: 10000, // 10,000 sats for captains
    subscriptionNwcUri: 'nostr+walletconnect://30f239de1ae8acccf8f2daa8b13883f7fe231418929db0d7963f88c26e6c6816?relay=wss://scornfulsalt9.lnbits.com/nostrclient/api/v1/relay&secret=5ea5ef12f03f34b562758ea9d4f9fc1b0543506861ccf65b06a7d59948251a46', // NWC URI for subscription collection
    openSatsNwcUri: 'nostr+walletconnect://30f239de1ae8acccf8f2daa8b13883f7fe231418929db0d7963f88c26e6c6816?relay=wss://scornfulsalt9.lnbits.com/nostrclient/api/v1/relay&secret=80eb7165272acd3258bd434d1c6f02d54e015c6f8064699e70c8e5c881858ad6', // NWC URI for Open Sats
    appDevNwcUri: 'nostr+walletconnect://30f239de1ae8acccf8f2daa8b13883f7fe231418929db0d7963f88c26e6c6816?relay=wss://scornfulsalt9.lnbits.com/nostrclient/api/v1/relay&secret=b74d86b62fc7f5ef90b3237f596887835ac299483ad4162f2cf26bd5849bc1aa', // NWC URI for app development
    prizePool: {
      first: 50000, // 50k sats for 1st place
      second: 30000, // 30k sats for 2nd place  
      third: 20000, // 20k sats for 3rd place
    }
  }
} as const;

export interface EventConfig {
  readonly regFee: number;
  readonly finishReward: number;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly distanceKm: number;
  readonly nostrRelay?: string; // Optional recommended relay for event posts
}

type ValueOf<T> = T[keyof T];
export type RewardKey = keyof typeof REWARDS;
// export type StreakConfig = typeof REWARDS["STREAK"]; // Now an interface
export type DailyLeaderboardConfig = typeof REWARDS["DAILY_LEADERBOARD"]; // Now an interface
export type Event100kConfig = typeof REWARDS["EVENT_100K"]; // Now an interface
// Season1Config is now defined as an interface above

export const MIN_STREAK_DISTANCE = {
  km: 0, // lowered from 500 (0.5 km) to allow any run to qualify during testing
  mi: 0, // lowered from 804 (0.5 mi) to allow any run to qualify
} as const; 