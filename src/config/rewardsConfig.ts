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
  readonly rewardsPoolAddress: string; // Lightning address for rewards pool
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
    rewardsPoolAddress: 'runstr@geyser.fund', // Using existing address for now
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
export type Season1Config = typeof REWARDS["SEASON_1"]; // Season 1 config type

export const MIN_STREAK_DISTANCE = {
  km: 0, // lowered from 500 (0.5 km) to allow any run to qualify during testing
  mi: 0, // lowered from 804 (0.5 mi) to allow any run to qualify
} as const; 