export interface StreakConfig {
  readonly satsPerDay: number;
  readonly capDays: number;
  readonly subscriberMultipliers: {
    readonly member: number;
    readonly captain: number;
  };
}

export interface LeaderboardConfig {
  readonly first: number;
  readonly second: number;
  readonly third: number;
}

export const REWARDS = {
  STREAK: {
    satsPerDay: 100, // Base rate: 100 sats for day 1
    capDays: 7, // maximum days considered when calculating payout
    subscriberMultipliers: {
      member: 2.85,  // 285 sats/day for members (2k sats max/week)
      captain: 3.0   // 300 sats/day for captains  
    }
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
    passPrice: 10000,
    startUtc: '2025-07-11T00:00:00Z', // Official RUNSTR SEASON 1: July 11 - October 9
    endUtc: '2025-10-09T23:59:59Z',   // Official RUNSTR SEASON 1: July 11 - October 9
    title: 'RUNSTR SEASON 1'
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

export interface SeasonConfig {
  readonly passPrice: number;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly title: string;
}

type ValueOf<T> = T[keyof T];
export type RewardKey = keyof typeof REWARDS;
// export type StreakConfig = typeof REWARDS["STREAK"]; // Now an interface
export type DailyLeaderboardConfig = typeof REWARDS["DAILY_LEADERBOARD"]; // Now an interface
export type Event100kConfig = typeof REWARDS["EVENT_100K"]; // Now an interface
export type Season1Config = typeof REWARDS["SEASON_1"]; // Now an interface

export const MIN_STREAK_DISTANCE = {
  km: 0, // lowered from 500 (0.5 km) to allow any run to qualify during testing
  mi: 0, // lowered from 804 (0.5 mi) to allow any run to qualify
} as const; 