export interface GameConfig {
  id: string;
  name: string;
  killsWeight: number;
  deathsWeight: number;
  assistsWeight: number;
  scoreWeight: number;
  baseRating: number;
  scoreOnly?: boolean;
}

export interface PlayerStats {
  name: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  team?: string;
  rating: number;
  originalTeam?: string;
}

export interface PlayerGameHistory {
  matchesCount: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalScore: number;
  averageRating: number;
  ratingHistory: { matchId: string; rating: number; date: string }[];
}

export interface PlayerHistory {
  name: string; // unique lowercase key
  displayName: string;
  games: {
    [gameId: string]: PlayerGameHistory;
  };
  lockedWith?: string[];
  forcedOpposite?: string[];
  avatar?: string;
}

export interface MatchRecord {
  id: string;
  date: string;
  gameId: string;
  gameName: string;
  screenshotsCount: number;
  players: PlayerStats[];
  teams?: {
    teamA: {
      players: PlayerStats[];
      totalRating: number;
    };
    teamB: {
      players: PlayerStats[];
      totalRating: number;
    };
    difference: number;
  };
}

export interface TeamSplit {
  teamA: PlayerStats[];
  teamB: PlayerStats[];
  totalRatingA: number;
  totalRatingB: number;
  difference: number;
  sizeDiff: number;
  constraintsSatisfied: boolean;
}
