import React, { useState, useEffect } from "react";
import { Gamepad2, Users, Database, Settings, History, Info, Sparkles, RefreshCw, AlertCircle, Trash2, Trophy, LogOut } from "lucide-react";
import { GameConfig, PlayerHistory, MatchRecord, PlayerStats } from "./types";
import ScoreboardExtractor from "./components/ScoreboardExtractor";
import TeamGenerator from "./components/TeamGenerator";
import PlayerStatsManager from "./components/PlayerStatsManager";
import GameFormulaSettings from "./components/GameFormulaSettings";
import MatchHistoryView from "./components/MatchHistoryView";
import LeaderboardView from "./components/LeaderboardView";
import AuthScreen from "./components/AuthScreen";
import { apiFetch } from "./lib/api";

export default function App() {
  const [activeTab, setActiveTab] = useState<"balancer" | "leaderboard" | "players" | "games" | "history">("balancer");
  const [games, setGames] = useState<GameConfig[]>([]);
  const [activeGameId, setActiveGameId] = useState("");
  const [registeredPlayers, setRegisteredPlayers] = useState<PlayerHistory[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [currentPlayers, setCurrentPlayers] = useState<PlayerStats[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [hasUsers, setHasUsers] = useState<boolean>(true);

  // Load all foundational data from Express APIs
  const loadData = async () => {
    setIsLoading(true);
    setGlobalError(null);
    try {
      // 1. Fetch Games list
      const gamesRes = await apiFetch("/api/games");
      if (!gamesRes.ok) throw new Error("Failed to load game configurations.");
      const gamesData = await gamesRes.json();

      // 2. Fetch Active Game ID
      const activeRes = await apiFetch("/api/active-game");
      const { activeGameId: actId } = activeRes.ok ? await activeRes.json() : { activeGameId: "cod" };

      // 3. Fetch Registered Players
      const playersRes = await apiFetch("/api/players");
      const playersData = playersRes.ok ? await playersRes.json() : [];

      // 4. Fetch Match History Logs
      const matchesRes = await apiFetch("/api/matches");
      const matchesData = matchesRes.ok ? await matchesRes.json() : [];

      setGames(gamesData);
      setActiveGameId(actId || gamesData[0]?.id || "cod");
      setRegisteredPlayers(playersData);
      setMatches(matchesData);
    } catch (err: any) {
      console.error("Load Data Error:", err);
      setGlobalError(err.message || "Could not reach the server APIs. Check if the server built successfully.");
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      const res = await apiFetch("/api/auth/check");
      if (res.ok) {
        const data = await res.json();
        setHasUsers(data.hasUsers);
        if (data.authenticated) {
          setIsAuthenticated(true);
          setCurrentUser(data.username);
          loadData();
        } else {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Auth Check Error:", err);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAuthSuccess = (token: string, username: string) => {
    setIsAuthenticated(true);
    setCurrentUser(username);
    setHasUsers(true);
    loadData();
  };

  const handleLogout = () => {
    localStorage.removeItem("cod_balancer_token");
    localStorage.removeItem("cod_balancer_username");
    setIsAuthenticated(false);
    setCurrentUser(null);
    setGames([]);
    setRegisteredPlayers([]);
    setMatches([]);
    setCurrentPlayers([]);
  };

  const activeGameConfig = games.find((g) => g.id === activeGameId) || games[0] || {
    id: "cod",
    name: "Call of Duty",
    killsWeight: 2.0,
    deathsWeight: 1.2,
    assistsWeight: 0.6,
    scoreWeight: 0.01,
    baseRating: 15,
    scoreOnly: true,
  };

  // Helper formula mapping for calculations
  const calculateRating = (p: { kills: number; deaths: number; assists: number; score: number }) => {
    if (activeGameConfig.scoreOnly) {
      const rating = activeGameConfig.baseRating + p.score * activeGameConfig.scoreWeight;
      return Math.max(0, parseFloat(rating.toFixed(1)));
    }
    const rating =
      activeGameConfig.baseRating +
      p.kills * activeGameConfig.killsWeight +
      p.assists * activeGameConfig.assistsWeight +
      p.score * activeGameConfig.scoreWeight -
      p.deaths * activeGameConfig.deathsWeight;
    return Math.max(0, parseFloat(rating.toFixed(1)));
  };

  // Handle successful AI OCR score extracting
  const handleExtractSuccess = (data: { gameName: string; players: PlayerStats[] }) => {
    const matchedGame = games.find(
      (g) => g.name.toLowerCase().includes(data.gameName.toLowerCase()) || data.gameName.toLowerCase().includes(g.name.toLowerCase())
    );

    if (matchedGame && matchedGame.id !== activeGameId) {
      setActiveGameId(matchedGame.id);
      apiFetch("/api/active-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: matchedGame.id }),
      });
    }

    setCurrentPlayers(data.players);
    setTimeout(() => {
      document.getElementById("team-generator-card")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
  };

  // Set active game ID toggles
  const handleSetActiveGame = async (gameId: string) => {
    try {
      const res = await apiFetch("/api/active-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        setActiveGameId(gameId);
        // Recalculate current player ratings
        setCurrentPlayers((prev) =>
          prev.map((p) => {
            const targetGameConfig = games.find((g) => g.id === gameId) || activeGameConfig;
            let rating = 0;
            if (targetGameConfig.scoreOnly) {
              rating = targetGameConfig.baseRating + p.score * targetGameConfig.scoreWeight;
            } else {
              rating =
                targetGameConfig.baseRating +
                p.kills * targetGameConfig.killsWeight +
                p.assists * targetGameConfig.assistsWeight +
                p.score * targetGameConfig.scoreWeight -
                p.deaths * targetGameConfig.deathsWeight;
            }
            return {
              ...p,
              rating: Math.max(0, parseFloat(rating.toFixed(1))),
            };
          })
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reset the entire DB settings to fresh defaults
  const handleResetAllData = async () => {
    if (!window.confirm("CRITICAL WARNING: This will permanently delete all registered players, custom formulas, matchup constraints, and logged match histories. Are you absolutely sure?")) return;
    try {
      const res = await apiFetch("/api/reset", { method: "POST" });
      if (res.ok) {
        setCurrentPlayers([]);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isAdmin = currentUser?.toLowerCase().trim() === "jpsauce";

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center p-4">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-mono text-xs text-slate-500 tracking-widest uppercase animate-pulse">Establishing Tactical Connection...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} initialHasUsers={hasUsers} />;
  }

  return (
    <div className="min-h-screen bg-[#0c0f17] text-gray-100 flex flex-col font-sans select-none antialiased">
      {/* Gaming header banner */}
      <header className="border-b border-slate-900 bg-[#0e1320] sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 shadow shadow-emerald-500/20">
              <Gamepad2 className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-md sm:text-lg font-black tracking-wider text-white">
                JPEIGHTS
              </h1>
              <p className="text-[10px] sm:text-[11px] font-bold text-emerald-400/80 tracking-wider font-mono">
                MULTIPLAYER TEAM BALANCER & STATS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser && (
              <div className="hidden sm:flex flex-col items-end mr-2 font-mono">
                <span className={`text-[9px] font-bold uppercase tracking-widest leading-none ${isAdmin ? "text-amber-500" : "text-gray-500"}`}>
                  {isAdmin ? "ADMINISTRATOR" : "OPERATOR"}
                </span>
                <span className={`text-xs font-black tracking-wide leading-normal ${isAdmin ? "text-amber-400" : "text-emerald-400"}`}>
                  {currentUser}
                </span>
              </div>
            )}
            <button
              onClick={loadData}
              title="Refresh database"
              className="p-2 rounded-lg border border-slate-800 text-gray-400 hover:text-white bg-slate-900 hover:bg-slate-850 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            {isAdmin && (
              <button
                onClick={handleResetAllData}
                title="Reset Database to Defaults"
                className="p-2 rounded-lg border border-red-900/30 text-red-400 hover:text-red-300 bg-red-950/10 hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleLogout}
              title="Log Out Operator"
              className="p-2 rounded-lg border border-slate-800 text-red-400 hover:text-red-300 bg-slate-900 hover:bg-slate-850 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Active game formula banner */}
        <div className="bg-gradient-to-r from-blue-950/20 via-purple-950/10 to-transparent border border-[#1e293b]/50 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="text-blue-400 w-5 h-5 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">
                Active Game Metric: <span className="text-emerald-400 font-extrabold">{activeGameConfig.name}</span>
              </p>
              <p className="text-xs text-gray-400 font-mono">
                Formula: {activeGameConfig.baseRating} + (Kills × {activeGameConfig.killsWeight}) + (Assists × {activeGameConfig.assistsWeight}) + (Score × {activeGameConfig.scoreWeight}) − (Deaths × {activeGameConfig.deathsWeight})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold font-mono bg-[#0e1320] border border-slate-900 px-3 py-1.5 rounded-lg text-emerald-400/90 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            AI MATCHMAKER ONLINE
          </div>
        </div>

        {/* Global connection error */}
        {globalError && (
          <div className="flex items-start gap-3 bg-red-950/20 border border-red-900/50 p-4 rounded-xl text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="font-semibold text-red-200">Database Connection Error</p>
              <p className="mt-1">{globalError}</p>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-900 overflow-x-auto scrollbar-none">
          <button
            id="tab-balancer"
            onClick={() => setActiveTab("balancer")}
            className={`flex items-center gap-2 py-3.5 px-5 font-bold text-sm tracking-tight border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "balancer"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" /> Roster & Balanced Teams
          </button>
          <button
            id="tab-leaderboard"
            onClick={() => setActiveTab("leaderboard")}
            className={`flex items-center gap-2 py-3.5 px-5 font-bold text-sm tracking-tight border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "leaderboard"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Trophy className="w-4 h-4" /> Leaderboard
          </button>
          <button
            id="tab-players"
            onClick={() => setActiveTab("players")}
            className={`flex items-center gap-2 py-3.5 px-5 font-bold text-sm tracking-tight border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "players"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Database className="w-4 h-4" /> Players Database
          </button>
          <button
            id="tab-games"
            onClick={() => setActiveTab("games")}
            className={`flex items-center gap-2 py-3.5 px-5 font-bold text-sm tracking-tight border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "games"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Settings className="w-4 h-4" /> Formula Weights
          </button>
          <button
            id="tab-history"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 py-3.5 px-5 font-bold text-sm tracking-tight border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "history"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <History className="w-4 h-4" /> Match Log History
          </button>
        </div>

        {/* Tab View Contents */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-gray-400 text-sm">Synchronizing match scoreboards database...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === "balancer" && (
              <div className="space-y-6">
                <ScoreboardExtractor
                  onExtractSuccess={handleExtractSuccess}
                  gameConfig={activeGameConfig}
                  currentPlayers={currentPlayers}
                  setCurrentPlayers={setCurrentPlayers}
                  calculateRating={calculateRating}
                  registeredPlayers={registeredPlayers}
                  onRefresh={loadData}
                />
                <TeamGenerator
                  currentPlayers={currentPlayers}
                  gameConfig={activeGameConfig}
                  registeredPlayers={registeredPlayers}
                  onSaveMatchSuccess={loadData}
                />
              </div>
            )}

            {activeTab === "leaderboard" && (
              <LeaderboardView
                players={registeredPlayers}
                games={games}
                activeGameId={activeGameId}
                onSetActiveGame={handleSetActiveGame}
              />
            )}

            {activeTab === "players" && (
              <PlayerStatsManager
                players={registeredPlayers}
                gameConfig={activeGameConfig}
                onRefresh={loadData}
                isAdmin={isAdmin}
              />
            )}

            {activeTab === "games" && (
              <GameFormulaSettings
                games={games}
                activeGameId={activeGameId}
                onRefresh={loadData}
                onSetActiveGame={handleSetActiveGame}
                isAdmin={isAdmin}
              />
            )}

            {activeTab === "history" && (
              <MatchHistoryView
                matches={matches}
                onRefresh={loadData}
                isAdmin={isAdmin}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#07090f] py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-[10px] text-gray-600 font-mono tracking-widest uppercase">
          Multiplayer Team Balancer &bull; Powered by Google Gemini 3.5 Flash &bull; All Rights Reserved
        </div>
      </footer>
    </div>
  );
}
