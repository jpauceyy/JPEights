import express from "express";
import path from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { dbHelpers, calculateRating, initDb } from "./src/db/db";
import { balanceTeams } from "./src/utils/balancer";

// Load environment variables
dotenv.config();

// Initialize the Database
initDb();

// Initialize Gemini SDK lazily if key exists
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Use JSON parsing with large limits for screenshot uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- Authentication Helpers & Middleware ---

const SECRET_KEY = process.env.SESSION_SECRET || "cod-balancer-secret-key-999";

function generateToken(username: string): string {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const data = `${username}:${expires}`;
  const signature = crypto.createHmac("sha256", SECRET_KEY).update(data).digest("hex");
  return Buffer.from(`${data}:${signature}`).toString("base64");
}

function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [username, expiresStr, signature] = parts;
    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || expires < Date.now()) {
      return null;
    }
    const data = `${username}:${expires}`;
    const expectedSignature = crypto.createHmac("sha256", SECRET_KEY).update(data).digest("hex");
    if (signature === expectedSignature) {
      return username;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function isAdmin(username: string): boolean {
  return username.toLowerCase().trim() === "jpsauce";
}

function authMiddleware(req: any, res: any, next: any) {
  if (dbHelpers.getUsersCount() === 0) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. Missing authentication token." });
  }

  const token = authHeader.split(" ")[1];
  const username = verifyToken(token);
  if (!username) {
    return res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
  }

  req.user = username;
  next();
}

function adminMiddleware(req: any, res: any, next: any) {
  if (dbHelpers.getUsersCount() === 0) {
    return next();
  }
  if (!req.user || !isAdmin(req.user)) {
    return res.status(403).json({ error: "Access Denied. Operator JPSauce administrator role is required to modify this settings configuration." });
  }
  next();
}

// --- API Routes ---

// Apply authMiddleware to all API routes EXCEPT health, auth endpoints
app.use("/api", (req, res, next) => {
  const pathLower = req.path.toLowerCase();
  const urlLower = req.originalUrl.toLowerCase();

  if (
    pathLower === "/health" ||
    pathLower.startsWith("/auth/") ||
    pathLower.startsWith("/api/auth/") ||
    pathLower.startsWith("/api/health") ||
    urlLower.includes("/auth/") ||
    urlLower.includes("/health")
  ) {
    return next();
  }
  authMiddleware(req, res, next);
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.post("/api/auth/register", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const trimmedUser = username.trim();
    if (trimmedUser.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters long." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    const success = dbHelpers.registerUser(trimmedUser, passwordHash);
    if (!success) {
      return res.status(400).json({ error: "Username is already registered." });
    }

    const token = generateToken(trimmedUser);
    res.json({ success: true, token, username: trimmedUser, isAdmin: isAdmin(trimmedUser) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const user = dbHelpers.getUser(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const hash = crypto.createHash("sha256").update(password).digest("hex");
    if (user.passwordHash !== hash) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = generateToken(user.username);
    res.json({ success: true, token, username: user.username, isAdmin: isAdmin(user.username) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/check", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const hasUsers = dbHelpers.getUsersCount() > 0;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({ authenticated: false, hasUsers });
    }

    const token = authHeader.split(" ")[1];
    const username = verifyToken(token);
    if (!username) {
      return res.json({ authenticated: false, hasUsers });
    }

    res.json({ authenticated: true, username, hasUsers, isAdmin: isAdmin(username) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Game config routes
app.get("/api/games", (req, res) => {
  try {
    res.json(dbHelpers.getGames());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/games", adminMiddleware, (req, res) => {
  try {
    const { id, name, killsWeight, deathsWeight, assistsWeight, scoreWeight, baseRating, scoreOnly } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: "Missing required fields: id, name" });
    }
    const saved = dbHelpers.saveGameConfig({
      id,
      name,
      killsWeight: Number(killsWeight ?? 2),
      deathsWeight: Number(deathsWeight ?? 1),
      assistsWeight: Number(assistsWeight ?? 0.5),
      scoreWeight: Number(scoreWeight ?? 0.01),
      baseRating: Number(baseRating ?? 10),
      scoreOnly: scoreOnly === undefined ? false : Boolean(scoreOnly),
    });
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/games/:id", adminMiddleware, (req, res) => {
  try {
    dbHelpers.deleteGame(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/active-game", (req, res) => {
  try {
    res.json({ activeGameId: dbHelpers.getActiveGameId() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/active-game", (req, res) => {
  try {
    const { gameId } = req.body;
    if (!gameId) {
      return res.status(400).json({ error: "Missing gameId" });
    }
    dbHelpers.setActiveGameId(gameId);
    res.json({ success: true, activeGameId: gameId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Player history routes
app.get("/api/players", (req, res) => {
  try {
    res.json(dbHelpers.getPlayers());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/players/register", (req, res) => {
  try {
    const { displayName, avatar } = req.body;
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: "Missing required field: displayName" });
    }
    const player = dbHelpers.registerPlayer(displayName, avatar);
    res.json(player);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/players/:name", adminMiddleware, (req, res) => {
  try {
    dbHelpers.deletePlayer(req.params.name);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/players/:name", (req, res) => {
  try {
    const player = dbHelpers.getPlayer(req.params.name);
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    res.json(player);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/players/:name/rules", adminMiddleware, (req, res) => {
  try {
    const { lockedWith, forcedOpposite } = req.body;
    const player = dbHelpers.savePlayerRules(req.params.name, {
      lockedWith: Array.isArray(lockedWith) ? lockedWith : [],
      forcedOpposite: Array.isArray(forcedOpposite) ? forcedOpposite : [],
    });
    res.json(player);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Match routes
app.get("/api/matches", (req, res) => {
  try {
    res.json(dbHelpers.getMatches());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/matches", (req, res) => {
  try {
    const { id, gameId, gameName, screenshotsCount, players, teams, gameMode, teamAScore, teamBScore } = req.body;
    if (!gameId || !players || !Array.isArray(players)) {
      return res.status(400).json({ error: "Missing required fields: gameId, players" });
    }
    const match = dbHelpers.saveMatch({
      id: id || `match_${Date.now()}`,
      date: new Date().toISOString(),
      gameId,
      gameName: gameName || "Unknown Game",
      screenshotsCount: Number(screenshotsCount || 0),
      players,
      teams,
      gameMode,
      teamAScore,
      teamBScore,
    });
    res.json(match);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/matches/:id", adminMiddleware, (req, res) => {
  try {
    dbHelpers.deleteMatch(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reset", adminMiddleware, (req, res) => {
  try {
    dbHelpers.resetAllData();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Team balancer endpoint
app.post("/api/balance", (req, res) => {
  try {
    const { players, gameId } = req.body;
    if (!players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: "Players list is required and cannot be empty" });
    }

    // Read current DB configuration for locks and opposites
    const db = dbHelpers.getPlayers();
    const locksMap: { [player: string]: string[] } = {};
    const oppositesMap: { [player: string]: string[] } = {};

    db.forEach((p) => {
      if (p.lockedWith && p.lockedWith.length > 0) {
        locksMap[p.displayName] = p.lockedWith;
      }
      if (p.forcedOpposite && p.forcedOpposite.length > 0) {
        oppositesMap[p.displayName] = p.forcedOpposite;
      }
    });

    // Recalculate ratings with the active formula if requested
    const games = dbHelpers.getGames();
    const targetGameId = gameId || dbHelpers.getActiveGameId();
    const gameConfig = games.find((g) => g.id === targetGameId) || games[0];

    const evaluatedPlayers = players.map((p) => {
      const rating = calculateRating(p, gameConfig);
      return {
        ...p,
        rating,
      };
    });

    const split = balanceTeams(evaluatedPlayers, locksMap, oppositesMap);

    if (!split) {
      return res.status(500).json({ error: "Could not balance teams. Check if constraint set has contradictions." });
    }

    res.json({
      ...split,
      players: evaluatedPlayers,
      gameConfig,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI OCR Scoreboard understanding via Gemini Vision API
app.post("/api/gemini/extract", async (req, res) => {
  try {
    const { screenshots } = req.body; // array of objects: { mimeType: string, data: string (base64) }
    if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
      return res.status(400).json({ error: "screenshots array is required and cannot be empty" });
    }

    const ai = getGeminiClient();

    // Convert screenshots to Gemini parts
    const imageParts = screenshots.map((shot) => {
      // Clean prefix if any
      let cleanBase64 = shot.data;
      if (cleanBase64.includes("base64,")) {
        cleanBase64 = cleanBase64.split("base64,")[1];
      }
      return {
        inlineData: {
          mimeType: shot.mimeType || "image/jpeg",
          data: cleanBase64,
        },
      };
    });

    const systemPrompt = `You are a professional esports gaming assistant specialized in game scoreboard parsing and OCR. 
You will be given one or more scoreboard screenshots. Your job is to extract EVERY player and their exact statistics correctly.

Guidelines for Player Name extraction:
- Clean player names by removing level numbers (e.g., 55, 318, 437, 438), indicators (e.g., "◀", "<", ">"), prestige symbols, or icon descriptors that might be adjacent to or prefix the name.
- Example: If the row reads "437 ◀ PeskySumo" or "55 ADI", extract "PeskySumo" or "ADI".

Guidelines for Column Mapping:
- Extract the columns accurately: Player Name, Kills, Deaths, Assists, and Score.
- Score is often labeled as Score, Combat Score, Points, or Damage. Map it logically to a single integer.
- For Call of Duty screenshots (like Search & Destroy), individual kills, deaths, and assists may not be displayed for all players in the main list table (they are only visible for the currently selected player at the bottom). For any player where kills/deaths/assists are not visible in the table, set them to 0. Do not guess or hallucinate stats.
- Extract the exact "SCORE" value for every player (e.g., 1670, 1285, 680, 1400, 1260, 800).
- If there are multiple pages or screenshots showing overlap of players or the other half of the match scoreboard, merge them into a single list of unique players. 
- Identify the game if visible, such as Valorant, Call of Duty, Counter-Strike, Apex Legends, League of Legends, Halo, Overwatch, etc. If unsure, specify "Custom / Generic".`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        ...imageParts,
        {
          text: "Extract all players and their statistics (kills, deaths, assists, score, original team/color) into the required structured JSON schema.",
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gameName: {
              type: Type.STRING,
              description: "Recognized name of the video game (e.g., Valorant, Call of Duty, CS2, Overwatch)",
            },
            players: {
              type: Type.ARRAY,
              description: "Array of extracted players",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "The gamer tag, username or online ID of the player",
                  },
                  kills: {
                    type: Type.INTEGER,
                    description: "Kills count. Default 0 if not present.",
                  },
                  deaths: {
                    type: Type.INTEGER,
                    description: "Deaths count. Default 0 if not present.",
                  },
                  assists: {
                    type: Type.INTEGER,
                    description: "Assists count. Default 0 if not present.",
                  },
                  score: {
                    type: Type.INTEGER,
                    description: "Overall scoreboard score, combat score, points, or damage. Default 0 if not present.",
                  },
                  originalTeam: {
                    type: Type.STRING,
                    description: "Original team (e.g. Red, Blue, Attackers, Defenders, Alpha, Omega, Terrorist, Counter-Terrorist) if shown on the scoreboard. Optional.",
                  },
                },
                required: ["name"],
              },
            },
          },
          required: ["gameName", "players"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return res.status(500).json({ error: "Gemini did not return any parseable response" });
    }

    const extractedData = JSON.parse(responseText.trim());
    res.json(extractedData);
  } catch (err: any) {
    console.error("Gemini Extraction Error:", err);
    res.status(500).json({ error: err.message || "Failed to process images via Gemini" });
  }
});

// Export the Express app for Vercel serverless functions
export default app;

// --- Local Development Server ---
// Only start listening when NOT running on Vercel
if (!process.env.VERCEL) {
  (async () => {
    if (process.env.NODE_ENV !== "production") {
      // Integrate Vite in development (dynamic import so it's not bundled for Vercel)
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      // Serve static files in production
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })().catch((err) => {
    console.error("Failed to start server:", err);
  });
}
