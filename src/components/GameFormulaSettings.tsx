import React, { useState } from "react";
import { Settings, Plus, Sparkles, AlertCircle, Save, Check, Gamepad2, Trash2 } from "lucide-react";
import { GameConfig } from "../types";
import { apiFetch } from "../lib/api";

interface GameFormulaSettingsProps {
  games: GameConfig[];
  activeGameId: string;
  onRefresh: () => void;
  onSetActiveGame: (gameId: string) => void;
  isAdmin?: boolean;
}

export default function GameFormulaSettings({
  games,
  activeGameId,
  onRefresh,
  onSetActiveGame,
  isAdmin = false,
}: GameFormulaSettingsProps) {
  const [selectedGameId, setSelectedGameId] = useState(activeGameId);
  const [newGameName, setNewGameName] = useState("");
  const [newGameId, setNewGameId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Active game config editing states
  const activeGame = games.find((g) => g.id === selectedGameId) || games[0];
  const [killsW, setKillsW] = useState(activeGame?.killsWeight ?? 2.0);
  const [deathsW, setDeathsW] = useState(activeGame?.deathsWeight ?? 1.0);
  const [assistsW, setAssistsW] = useState(activeGame?.assistsWeight ?? 0.5);
  const [scoreW, setScoreW] = useState(activeGame?.scoreWeight ?? 0.01);
  const [baseR, setBaseR] = useState(activeGame?.baseRating ?? 10);
  const [scoreOnly, setScoreOnly] = useState(activeGame?.scoreOnly ?? false);

  // Sync sliders when selecting a different game
  React.useEffect(() => {
    const game = games.find((g) => g.id === selectedGameId);
    if (game) {
      setKillsW(game.killsWeight);
      setDeathsW(game.deathsWeight);
      setAssistsW(game.assistsWeight);
      setScoreW(game.scoreWeight);
      setBaseR(game.baseRating);
      setScoreOnly(game.scoreOnly ?? false);
      setSaveStatus(null);
    }
  }, [selectedGameId, games]);

  // Handle saving weight formula configs
  const handleSaveFormula = async () => {
    if (!activeGame) return;
    setSaveStatus(null);
    try {
      const res = await apiFetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeGame.id,
          name: activeGame.name,
          killsWeight: killsW,
          deathsWeight: deathsW,
          assistsWeight: assistsW,
          scoreWeight: scoreW,
          baseRating: baseR,
          scoreOnly: scoreOnly,
        }),
      });

      if (!res.ok) throw new Error("Failed to save rating formula configuration.");
      setSaveStatus("Formula weights saved successfully!");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Register a new game
  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newGameName || !newGameId) {
      setError("Please fill in all game fields.");
      return;
    }

    const cleanId = newGameId.toLowerCase().replace(/[^a-z0-9]/g, "");

    if (games.some((g) => g.id === cleanId)) {
      setError("Game ID already exists. Use a unique short ID.");
      return;
    }

    try {
      const res = await apiFetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cleanId,
          name: newGameName,
          killsWeight: 2.0,
          deathsWeight: 1.0,
          assistsWeight: 0.5,
          scoreWeight: 0.01,
          baseRating: 10,
        }),
      });

      if (!res.ok) throw new Error("Failed to add game configuration.");
      setNewGameName("");
      setNewGameId("");
      onRefresh();
      setSelectedGameId(cleanId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete a game
  const handleDeleteGame = async (gameId: string) => {
    if (games.length <= 1) {
      setError("At least one game configuration must remain in the database.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this game config? All matching history averages will be hidden.")) return;

    try {
      const res = await apiFetch(`/api/games/${gameId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete game config.");
      onRefresh();
      // fallback selection
      const remaining = games.filter((g) => g.id !== gameId);
      setSelectedGameId(remaining[0]?.id || "custom");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formula Editor Panel */}
      <div className={`${isAdmin ? "lg:col-span-2" : "lg:col-span-3"} bg-[#121824] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="text-blue-400 w-5 h-5" /> Rating Formula Configuration
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Adjust weight values used to compute the overall performance rating for players.
            </p>
          </div>

          {/* Game Selection Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400">GAME:</span>
            <select
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              className="bg-[#0c0f17] border border-slate-800 text-sm font-semibold rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {activeGameId === g.id ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeGame && (
          <div className="space-y-6">
            {/* Score-Centric Mode Toggle */}
            <div className="bg-[#0e1320] border border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-black text-white uppercase tracking-wider block">Score-Centric Rating Mode</span>
                <span className="text-[11px] text-gray-400 block max-w-lg leading-relaxed">
                  Recommended for Call of Duty. If screenshots don't show all player kills/deaths (or they are missing/scrolled), ratings will compute cleanly off Combat Score alone.
                </span>
              </div>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => {
                  setScoreOnly(!scoreOnly);
                  setSaveStatus(null);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                  scoreOnly ? "bg-emerald-500" : "bg-slate-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    scoreOnly ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Visual Formula Display */}
            <div className="bg-[#0c0f17] border border-slate-900 p-5 rounded-xl text-center space-y-2">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                Calculated Rating Equation
              </span>
              <p className="text-sm md:text-md font-bold font-mono text-emerald-400 break-all select-all">
                {scoreOnly ? (
                  <>Rating = {baseR} + (Score * {scoreW})</>
                ) : (
                  <>Rating = {baseR} + (Kills * {killsW}) + (Assists * {assistsW}) + (Score * {scoreW}) - (Deaths * {deathsW})</>
                )}
              </p>
              <p className="text-[10px] text-gray-500 italic">
                {scoreOnly 
                  ? "Kills, deaths, and assists are ignored. Only the overall scoreboard score determines individual performance."
                  : "Values will always clip at a minimum score of 0 to avoid negative ratings."}
              </p>
            </div>

            {/* Weights Sliders */}
            <div className="space-y-5">
              {/* Kills Weight */}
              <div className={`space-y-2 transition-all duration-250 ${scoreOnly ? "opacity-25 pointer-events-none select-none" : ""}`}>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-300">Kills Coefficient {scoreOnly && <span className="text-xs text-slate-500 font-mono">(Disabled)</span>}</span>
                  <span className="font-mono font-bold text-blue-400">{killsW}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={killsW}
                  disabled={scoreOnly || !isAdmin}
                  onChange={(e) => {
                    setKillsW(parseFloat(e.target.value));
                    setSaveStatus(null);
                  }}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Assists Weight */}
              <div className={`space-y-2 transition-all duration-250 ${scoreOnly ? "opacity-25 pointer-events-none select-none" : ""}`}>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-300">Assists Coefficient {scoreOnly && <span className="text-xs text-slate-500 font-mono">(Disabled)</span>}</span>
                  <span className="font-mono font-bold text-purple-400">{assistsW}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={assistsW}
                  disabled={scoreOnly || !isAdmin}
                  onChange={(e) => {
                    setAssistsW(parseFloat(e.target.value));
                    setSaveStatus(null);
                  }}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Deaths Weight (Subtracted) */}
              <div className={`space-y-2 transition-all duration-250 ${scoreOnly ? "opacity-25 pointer-events-none select-none" : ""}`}>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-300">Deaths Penalty {scoreOnly && <span className="text-xs text-slate-500 font-mono">(Disabled)</span>}</span>
                  <span className="font-mono font-bold text-red-400">-{deathsW}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={deathsW}
                  disabled={scoreOnly || !isAdmin}
                  onChange={(e) => {
                    setDeathsW(parseFloat(e.target.value));
                    setSaveStatus(null);
                  }}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
              </div>

              {/* Score Weight */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-300">Combat Score Weight (Score * X)</span>
                  <span className="font-mono font-bold text-amber-400">{scoreW}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.005"
                  value={scoreW}
                  disabled={!isAdmin}
                  onChange={(e) => {
                    setScoreW(parseFloat(e.target.value));
                    setSaveStatus(null);
                  }}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Base Rating */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-300">Base Baseline Rating Offset</span>
                  <span className="font-mono font-bold text-emerald-400">{baseR}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={baseR}
                  disabled={!isAdmin}
                  onChange={(e) => {
                    setBaseR(parseInt(e.target.value));
                    setSaveStatus(null);
                  }}
                  className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-900">
              <div className="flex gap-2">
                <button
                  id="set-active-game-btn"
                  onClick={() => onSetActiveGame(selectedGameId)}
                  disabled={activeGameId === selectedGameId}
                  className="text-xs font-bold px-3 py-2 border border-slate-800 text-white rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {activeGameId === selectedGameId ? "Currently Selected Game" : `Activate "${activeGame.name}"`}
                </button>
                {isAdmin && (
                  <button
                    id="delete-game-config-btn"
                    onClick={() => handleDeleteGame(selectedGameId)}
                    className="text-xs font-semibold px-3 py-2 rounded-lg border border-red-900/40 text-red-400 hover:bg-red-950/20 transition-colors"
                  >
                    Delete Config
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {saveStatus && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> {saveStatus}
                  </span>
                )}
                {isAdmin ? (
                  <button
                    id="save-formula-config-btn"
                    onClick={handleSaveFormula}
                    className="flex items-center gap-1.5 text-xs font-black px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-lg shadow transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Formula Weights
                  </button>
                ) : (
                  <span className="text-xs text-amber-500 font-mono bg-amber-500/5 border border-amber-500/20 px-3 py-2 rounded-lg">
                    🔒 Admin Privilege Required to Edit Weights
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add New Game configuration */}
      {isAdmin && (
        <div className="bg-[#121824] border border-[#1e293b] rounded-xl p-6 shadow-2xl h-fit space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="text-emerald-400 w-4.5 h-4.5" /> Add Custom Game
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Register a new esports multiplayer game with customizable scoreboard formulas.
            </p>
          </div>

          <form onSubmit={handleCreateGame} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">Game Name</label>
              <input
                type="text"
                placeholder="e.g. Apex Legends"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                className="w-full bg-[#0c0f17] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">Unique Code Identifier</label>
              <input
                type="text"
                placeholder="e.g. apex"
                value={newGameId}
                onChange={(e) => setNewGameId(e.target.value)}
                className="w-full bg-[#0c0f17] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              />
              <p className="text-[10px] text-gray-500">
                Only alphanumeric lowercase codes (no spaces).
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs bg-red-950/20 border border-red-900/50 p-2.5 rounded-lg text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="add-game-config-submit"
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all cursor-pointer"
            >
              Create Game Config
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
