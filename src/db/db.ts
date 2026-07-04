import fs from "fs";
import path from "path";

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
  name: string; // lowercased unique identifier
  displayName: string; // capitalized
  games: {
    [gameId: string]: PlayerGameHistory;
  };
  lockedWith?: string[]; // player names locked together
  forcedOpposite?: string[]; // player names forced on opposite teams
  avatar?: string; // base64 or preset identifier
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

export interface DatabaseSchema {
  games: GameConfig[];
  players: { [nameLower: string]: PlayerHistory };
  matches: MatchRecord[];
  activeGameId: string;
  users?: { [usernameLower: string]: { username: string; passwordHash: string; createdAt: string } };
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

const defaultGames: GameConfig[] = [
  {
    id: "cod",
    name: "Call of Duty",
    killsWeight: 2.0,
    deathsWeight: 1.2,
    assistsWeight: 0.6,
    scoreWeight: 0.01,
    baseRating: 15,
    scoreOnly: true,
  },
  {
    id: "valorant",
    name: "Valorant",
    killsWeight: 1.5,
    deathsWeight: 1.0,
    assistsWeight: 0.5,
    scoreWeight: 0.05,
    baseRating: 10,
    scoreOnly: false,
  },
  {
    id: "counterstrike",
    name: "Counter-Strike 2",
    killsWeight: 2.0,
    deathsWeight: 1.0,
    assistsWeight: 1.0,
    scoreWeight: 0.02,
    baseRating: 10,
    scoreOnly: false,
  },
  {
    id: "custom",
    name: "Custom / Generic",
    killsWeight: 2.0,
    deathsWeight: 1.0,
    assistsWeight: 1.0,
    scoreWeight: 0.01,
    baseRating: 10,
    scoreOnly: false,
  }
];

const initialDb: DatabaseSchema = {
  games: defaultGames,
  players: {},
  matches: [],
  activeGameId: "cod",
  users: {},
};

export function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf-8");
  }
}

export function readDb(): DatabaseSchema {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    const db = JSON.parse(data);
    if (!db.users) {
      db.users = {};
    }
    return db;
  } catch (error) {
    console.error("Error reading database file, returning defaults:", error);
    return initialDb;
  }
}

export function writeDb(db: DatabaseSchema) {
  initDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

// Rating calculator based on weight configs
export function calculateRating(stats: { kills: number; deaths: number; assists: number; score: number }, config: GameConfig): number {
  if (config.scoreOnly) {
    const rating = config.baseRating + stats.score * config.scoreWeight;
    return Math.max(0, parseFloat(rating.toFixed(1)));
  }
  const rating =
    config.baseRating +
    stats.kills * config.killsWeight +
    stats.assists * config.assistsWeight +
    stats.score * config.scoreWeight -
    stats.deaths * config.deathsWeight;
  return Math.max(0, parseFloat(rating.toFixed(1)));
}

// Database helper functions
export const dbHelpers = {
  getGames: (): GameConfig[] => {
    return readDb().games;
  },

  saveGameConfig: (config: GameConfig): GameConfig => {
    const db = readDb();
    const idx = db.games.findIndex((g) => g.id === config.id);
    if (idx !== -1) {
      db.games[idx] = config;
    } else {
      db.games.push(config);
    }
    writeDb(db);
    return config;
  },

  deleteGame: (gameId: string) => {
    const db = readDb();
    db.games = db.games.filter((g) => g.id !== gameId);
    if (db.activeGameId === gameId) {
      db.activeGameId = db.games[0]?.id || "custom";
    }
    writeDb(db);
  },

  getActiveGameId: (): string => {
    return readDb().activeGameId;
  },

  setActiveGameId: (gameId: string) => {
    const db = readDb();
    db.activeGameId = gameId;
    writeDb(db);
  },

  getPlayers: (): PlayerHistory[] => {
    return Object.values(readDb().players);
  },

  getPlayer: (name: string): PlayerHistory | null => {
    const key = name.toLowerCase().trim();
    return readDb().players[key] || null;
  },

  registerPlayer: (displayName: string, avatar?: string): PlayerHistory => {
    const db = readDb();
    const key = displayName.toLowerCase().trim();
    if (!db.players[key]) {
      db.players[key] = {
        name: key,
        displayName: displayName.trim(),
        games: {},
        lockedWith: [],
        forcedOpposite: [],
        avatar: avatar || "",
      };
    } else {
      if (avatar !== undefined) {
        db.players[key].avatar = avatar;
      }
      db.players[key].displayName = displayName.trim();
    }
    writeDb(db);
    return db.players[key];
  },

  deletePlayer: (name: string) => {
    const db = readDb();
    const key = name.toLowerCase().trim();
    if (db.players[key]) {
      delete db.players[key];
      // Also clean up any references in lockedWith or forcedOpposite of other players
      Object.keys(db.players).forEach(pKey => {
        const p = db.players[pKey];
        if (p.lockedWith) {
          p.lockedWith = p.lockedWith.filter(item => item.toLowerCase() !== key);
        }
        if (p.forcedOpposite) {
          p.forcedOpposite = p.forcedOpposite.filter(item => item.toLowerCase() !== key);
        }
      });
      writeDb(db);
    }
  },

  savePlayerRules: (name: string, rules: { lockedWith?: string[]; forcedOpposite?: string[] }): PlayerHistory => {
    const db = readDb();
    const key = name.toLowerCase().trim();
    if (!db.players[key]) {
      db.players[key] = {
        name: key,
        displayName: name,
        games: {},
      };
    }
    
    // Clean rules of duplicate self-entries and keep them lowercase/trimmed
    const sanitizeList = (list?: string[]) => {
      if (!list) return [];
      return Array.from(new Set(
        list
          .map(item => item.trim())
          .filter(item => item && item.toLowerCase() !== key)
      ));
    };

    db.players[key].lockedWith = sanitizeList(rules.lockedWith);
    db.players[key].forcedOpposite = sanitizeList(rules.forcedOpposite);
    writeDb(db);
    return db.players[key];
  },

  getMatches: (): MatchRecord[] => {
    const db = readDb();
    return db.matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  saveMatch: (match: MatchRecord): MatchRecord => {
    const db = readDb();
    // Add match to history
    db.matches.push(match);

    // Update Player stats in DB
    const gameId = match.gameId;
    match.players.forEach((p) => {
      const pKey = p.name.toLowerCase().trim();
      if (!db.players[pKey]) {
        db.players[pKey] = {
          name: pKey,
          displayName: p.name,
          games: {},
          lockedWith: [],
          forcedOpposite: [],
        };
      }

      const player = db.players[pKey];
      if (!player.games[gameId]) {
        player.games[gameId] = {
          matchesCount: 0,
          totalKills: 0,
          totalDeaths: 0,
          totalAssists: 0,
          totalScore: 0,
          averageRating: 0,
          ratingHistory: [],
        };
      }

      const pg = player.games[gameId];
      pg.matchesCount += 1;
      pg.totalKills += p.kills;
      pg.totalDeaths += p.deaths;
      pg.totalAssists += p.assists;
      pg.totalScore += p.score;
      
      pg.ratingHistory.push({
        matchId: match.id,
        rating: p.rating,
        date: match.date,
      });

      // Recalculate average rating
      const sumRatings = pg.ratingHistory.reduce((acc, curr) => acc + curr.rating, 0);
      pg.averageRating = parseFloat((sumRatings / pg.matchesCount).toFixed(1));
    });

    writeDb(db);
    return match;
  },

  deleteMatch: (matchId: string) => {
    const db = readDb();
    const matchIdx = db.matches.findIndex(m => m.id === matchId);
    if (matchIdx === -1) return;

    const match = db.matches[matchIdx];
    const gameId = match.gameId;

    // Remove stats from players
    match.players.forEach(p => {
      const pKey = p.name.toLowerCase().trim();
      if (db.players[pKey] && db.players[pKey].games[gameId]) {
        const pg = db.players[pKey].games[gameId];
        pg.matchesCount = Math.max(0, pg.matchesCount - 1);
        pg.totalKills = Math.max(0, pg.totalKills - p.kills);
        pg.totalDeaths = Math.max(0, pg.totalDeaths - p.deaths);
        pg.totalAssists = Math.max(0, pg.totalAssists - p.assists);
        pg.totalScore = Math.max(0, pg.totalScore - p.score);
        pg.ratingHistory = pg.ratingHistory.filter(h => h.matchId !== matchId);

        if (pg.matchesCount > 0) {
          const sumRatings = pg.ratingHistory.reduce((acc, curr) => acc + curr.rating, 0);
          pg.averageRating = parseFloat((sumRatings / pg.matchesCount).toFixed(1));
        } else {
          pg.averageRating = 0;
        }
      }
    });

    db.matches.splice(matchIdx, 1);
    writeDb(db);
  },

  resetAllData: () => {
    writeDb(initialDb);
  },

  getUser: (username: string) => {
    const db = readDb();
    const key = username.toLowerCase().trim();
    if (!db.users) return null;
    return db.users[key] || null;
  },

  registerUser: (username: string, passwordHash: string): boolean => {
    const db = readDb();
    if (!db.users) db.users = {};
    const key = username.toLowerCase().trim();
    if (db.users[key]) {
      return false; // User already exists
    }
    db.users[key] = {
      username: username.trim(),
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    writeDb(db);
    return true;
  },

  getUsersCount: (): number => {
    const db = readDb();
    if (!db.users) return 0;
    return Object.keys(db.users).length;
  }
};
