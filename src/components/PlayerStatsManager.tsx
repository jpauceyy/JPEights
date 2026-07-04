import React, { useState, useRef } from "react";
import { User, Lock, EyeOff, Search, Save, Trash2, ShieldAlert, Sparkles, Plus, Upload, Image, Check } from "lucide-react";
import { PlayerHistory, GameConfig } from "../types";
import { apiFetch } from "../lib/api";

interface PlayerStatsManagerProps {
  players: PlayerHistory[];
  gameConfig: GameConfig;
  onRefresh: () => void;
  isAdmin?: boolean;
}

const PRESET_AVATARS = [
  { id: "price", label: "🇬🇧 Price", color: "from-emerald-600 to-green-800" },
  { id: "ghost", label: "💀 Ghost", color: "from-slate-700 to-slate-900" },
  { id: "soap", label: "🧼 Soap", color: "from-blue-500 to-indigo-700" },
  { id: "gaz", label: "🧢 Gaz", color: "from-sky-500 to-blue-600" },
  { id: "woods", label: "🌲 Woods", color: "from-amber-600 to-yellow-800" },
  { id: "mason", label: "🔢 Mason", color: "from-red-600 to-purple-800" },
  { id: "makarov", label: "🇷🇺 Makarov", color: "from-red-700 to-red-950" },
  { id: "farah", label: "⚡ Farah", color: "from-teal-500 to-cyan-700" },
];

export default function PlayerStatsManager({ players, gameConfig, onRefresh, isAdmin = false }: PlayerStatsManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerHistory | null>(null);
  
  // Registration / Edit states
  const [regName, setRegName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(""); // preset ID or base64
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Constraints states for selected player
  const [lockedWithInput, setLockedWithInput] = useState("");
  const [forcedOppositeInput, setForcedOppositeInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter players based on search query
  const filteredPlayers = players.filter((p) =>
    p.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render player avatar
  const renderAvatar = (player: PlayerHistory, sizeClass = "w-8 h-8 text-[10px]") => {
    if (player.avatar && player.avatar.startsWith("data:image/")) {
      return (
        <img
          src={player.avatar}
          alt={player.displayName}
          referrerPolicy="no-referrer"
          className={`${sizeClass} rounded-full object-cover border border-slate-700 shadow`}
        />
      );
    }

    const preset = PRESET_AVATARS.find((p) => p.id === player.avatar);
    if (preset) {
      const initials = player.displayName.slice(0, 2).toUpperCase();
      const emoji = preset.label.split(" ")[0];
      return (
        <div
          className={`${sizeClass} rounded-full bg-gradient-to-br ${preset.color} border border-white/10 flex items-center justify-center font-black text-white shadow relative`}
        >
          <span className="text-[9px] absolute -bottom-1 -right-1 bg-[#0c0f17] px-0.5 rounded-full border border-slate-800">
            {emoji}
          </span>
          {initials}
        </div>
      );
    }

    const initials = player.displayName.slice(0, 2).toUpperCase();
    return (
      <div
        className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-600 to-purple-600 border border-white/10 flex items-center justify-center font-bold text-white shadow`}
      >
        {initials}
      </div>
    );
  };

  // Handle player selection to edit constraints
  const handleSelectPlayer = (player: PlayerHistory) => {
    setSelectedPlayer(player);
    setLockedWithInput((player.lockedWith || []).join(", "));
    setForcedOppositeInput((player.forcedOpposite || []).join(", "));
    setStatusMsg(null);
  };

  // Handle uploading custom profile picture (reads file and converts to base64 data url)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatusMsg({ type: "error", text: "Image is too large. Choose a file under 2MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSelectedAvatar(reader.result);
        setStatusMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle creating/registering a player
  const handleRegisterPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      setStatusMsg({ type: "error", text: "Please enter a display name." });
      return;
    }

    setIsSaving(true);
    setStatusMsg(null);

    try {
      const res = await apiFetch("/api/players/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: regName,
          avatar: selectedAvatar,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to register player.");
      }

      setStatusMsg({ type: "success", text: "Legend registered successfully!" });
      setRegName("");
      setSelectedAvatar("");
      onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to register player." });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle saving constraint rules
  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer) return;
    setIsSaving(true);
    setStatusMsg(null);

    const parseListInput = (input: string) => {
      return input
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.toLowerCase() !== selectedPlayer.name);
    };

    const lockedWith = parseListInput(lockedWithInput);
    const forcedOpposite = parseListInput(forcedOppositeInput);

    try {
      const res = await apiFetch(`/api/players/${selectedPlayer.name}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockedWith, forcedOpposite }),
      });

      if (!res.ok) throw new Error("Failed to save matchup rules.");
      
      const updatedPlayer = await res.json();
      setSelectedPlayer(updatedPlayer);
      setStatusMsg({ type: "success", text: "Matchup constraints saved successfully!" });
      onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to save player rules." });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle deleting a player
  const handleDeletePlayer = async (player: PlayerHistory) => {
    if (!window.confirm(`Are you sure you want to completely unregister "${player.displayName}"? This will delete all of their accumulated game history and constraints!`)) return;
    
    try {
      const res = await apiFetch(`/api/players/${player.name}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to unregister player.");
      
      if (selectedPlayer?.name === player.name) {
        setSelectedPlayer(null);
      }
      
      setStatusMsg({ type: "success", text: `${player.displayName} has been removed.` });
      onRefresh();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to delete player." });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Players List */}
      <div className="lg:col-span-2 bg-[#121824] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <User className="text-blue-400 w-5 h-5" /> Registered Legends
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Active player roster. Stats are averages for <span className="text-white font-semibold">{gameConfig.name}</span>
            </p>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[#0c0f17] border border-slate-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 w-full sm:w-56"
            />
          </div>
        </div>

        {filteredPlayers.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-[#0c0f17]/30">
            <User className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No registered players found matching the query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-900">
            <table className="w-full text-left text-sm border-collapse bg-[#0c0f17]/50">
              <thead>
                <tr className="bg-[#121824] text-gray-400 text-xs uppercase tracking-wider font-bold">
                  <th className="py-3 px-4">Legend</th>
                  <th className="py-3 px-4 text-center">Matches</th>
                  <th className={`py-3 px-4 ${gameConfig.scoreOnly ? "opacity-30" : ""}`}>Avg K/D/A</th>
                  <th className="py-3 px-4">Avg Score</th>
                  <th className="py-3 px-4">Avg Rating</th>
                  <th className="py-3 px-4">Rules</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filteredPlayers.map((player) => {
                  const gameStats = player.games[gameConfig.id] || {
                    matchesCount: 0,
                    totalKills: 0,
                    totalDeaths: 0,
                    totalAssists: 0,
                    totalScore: 0,
                    averageRating: 0,
                  };

                  const avgKills = gameStats.matchesCount > 0 ? (gameStats.totalKills / gameStats.matchesCount).toFixed(1) : "0";
                  const avgDeaths = gameStats.matchesCount > 0 ? (gameStats.totalDeaths / gameStats.matchesCount).toFixed(1) : "0";
                  const avgAssists = gameStats.matchesCount > 0 ? (gameStats.totalAssists / gameStats.matchesCount).toFixed(1) : "0";
                  const avgScore = gameStats.matchesCount > 0 ? Math.round(gameStats.totalScore / gameStats.matchesCount) : 0;

                  return (
                    <tr key={player.name} className="hover:bg-[#121824]/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2.5">
                        {renderAvatar(player, "w-8 h-8")}
                        <div>
                          <span className="block leading-none text-white">{player.displayName}</span>
                          <span className="text-[10px] text-gray-500 font-mono">ID: {player.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-gray-300">{gameStats.matchesCount}</td>
                      <td className={`py-3 px-4 font-mono text-gray-400 text-xs ${gameConfig.scoreOnly ? "opacity-25" : ""}`}>
                        <span className="text-gray-200">{avgKills}</span> /{" "}
                        <span className="text-gray-200">{avgDeaths}</span> /{" "}
                        <span className="text-gray-200">{avgAssists}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-300">{avgScore}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">{gameStats.averageRating || "N/A"}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1.5">
                          {player.lockedWith && player.lockedWith.length > 0 && (
                            <span
                              title={`Locked with: ${player.lockedWith.join(", ")}`}
                              className="p-1 rounded bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-[10px] font-bold flex items-center gap-0.5"
                            >
                              <Lock className="w-2.5 h-2.5" /> LOCKS
                            </span>
                          )}
                          {player.forcedOpposite && player.forcedOpposite.length > 0 && (
                            <span
                              title={`Opposite to: ${player.forcedOpposite.join(", ")}`}
                              className="p-1 rounded bg-red-950/40 border border-red-900/30 text-red-400 text-[10px] font-bold flex items-center gap-0.5"
                            >
                              <EyeOff className="w-2.5 h-2.5" /> OPPOSITES
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            id={`manage-rules-btn-${player.name}`}
                            onClick={() => handleSelectPlayer(player)}
                            className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline animate-pulse"
                          >
                            {isAdmin ? "Rules" : "View Rules"}
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeletePlayer(player)}
                              className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-950/10"
                              title="Unregister player completely"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settings / Registration Panel */}
      <div className="space-y-6">
        {selectedPlayer ? (
          /* Constraints Settings Panel (Active only when a player is selected) */
          <div className="bg-[#121824] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="text-emerald-400 w-4.5 h-4.5" /> Matchup Constraints
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Ensure specific teammates always play together or are split onto opposing teams.
              </p>
            </div>

            <form onSubmit={handleSaveRules} className="space-y-4">
              <div className="bg-[#0c0f17] border border-slate-900 p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderAvatar(selectedPlayer, "w-8 h-8")}
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Configuring rules for</span>
                    <span className="text-sm font-bold text-emerald-400">{selectedPlayer.displayName}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlayer(null);
                    setStatusMsg(null);
                  }}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              {/* Locked With */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Locked Together With
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={lockedWithInput}
                  onChange={(e) => setLockedWithInput(e.target.value)}
                  className="w-full bg-[#0c0f17] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                  placeholder="e.g. Player2, Player3 (comma-separated)"
                />
                <p className="text-[10px] text-gray-500">
                  These players will always be assigned to the SAME team as {selectedPlayer.displayName}.
                </p>
              </div>

              {/* Forced Opposite */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-red-400" /> Forced Opposite From
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={forcedOppositeInput}
                  onChange={(e) => setForcedOppositeInput(e.target.value)}
                  className="w-full bg-[#0c0f17] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50 disabled:opacity-50"
                  placeholder="e.g. Player4, Player5 (comma-separated)"
                />
                <p className="text-[10px] text-gray-500">
                  These players will always be assigned to the OPPOSITE team from {selectedPlayer.displayName}.
                </p>
              </div>

              {/* Status message */}
              {statusMsg && (
                <div
                  className={`text-xs p-2.5 rounded-lg border ${
                    statusMsg.type === "success"
                      ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-300"
                      : "bg-red-950/20 border-red-900/40 text-red-300"
                  }`}
                >
                  {statusMsg.text}
                </div>
              )}

              {isAdmin ? (
                <button
                  id="save-rules-submit"
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? "Saving rules..." : "Save Matchup Rules"}
                </button>
              ) : (
                <div className="text-center text-xs text-amber-500/80 font-mono bg-amber-500/5 border border-amber-500/20 p-2.5 rounded-lg">
                  🔒 Admin Privilege Required to Edit Rules
                </div>
              )}
            </form>
          </div>
        ) : (
          /* Register New Player Panel (Shown by default) */
          <div className="bg-[#121824] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="text-blue-400 w-5 h-5" /> Register New Legend
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Add a player to the pool. Registered players are tracked across balance matching and logged onto the leaderboard.
              </p>
            </div>

            <form onSubmit={handleRegisterPlayer} className="space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-300">Display Name / Gamer Tag</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TenZ"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-[#0c0f17] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* Avatar Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 block">Profile Picture Option</label>
                
                {/* Upload customized file option */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-[#0c0f17] border border-slate-800 text-gray-300 hover:text-white hover:border-slate-700 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {selectedAvatar && selectedAvatar.startsWith("data:image/") ? (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-4 h-4" /> Custom Image Selected
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-500 italic">No custom file uploaded</span>
                  )}
                </div>

                {/* Preset Avatars Grid */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Or pick a Hero Preset:</span>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_AVATARS.map((av) => {
                      const isSelected = selectedAvatar === av.id;
                      return (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => {
                            setSelectedAvatar(av.id);
                            setStatusMsg(null);
                          }}
                          className={`group relative p-2.5 rounded-lg border flex flex-col items-center gap-1 bg-[#0c0f17] text-center transition-all ${
                            isSelected
                              ? "border-blue-500 ring-1 ring-blue-500/50 scale-105"
                              : "border-slate-800 hover:border-slate-700 hover:scale-[1.02]"
                          }`}
                          title={av.label}
                        >
                          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${av.color} flex items-center justify-center text-[9px] font-bold text-white`}>
                            {av.label.split(" ")[0]}
                          </div>
                          <span className="text-[8px] text-gray-400 group-hover:text-white truncate max-w-full">
                            {av.label.split(" ")[1]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Status message */}
              {statusMsg && (
                <div
                  className={`text-xs p-2.5 rounded-lg border ${
                    statusMsg.type === "success"
                      ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-300"
                      : "bg-red-950/20 border-red-900/40 text-red-300"
                  }`}
                >
                  {statusMsg.text}
                </div>
              )}

              <button
                id="register-player-submit"
                type="submit"
                disabled={isSaving}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> {isSaving ? "Registering..." : "Register Player"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
