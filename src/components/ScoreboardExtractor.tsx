import React, { useState, useRef } from "react";
import { Upload, X, Cpu, AlertCircle, Plus, Trash2, RefreshCw, UserCheck, HelpCircle, Check, UserPlus } from "lucide-react";
import { PlayerStats, GameConfig, PlayerHistory } from "../types";
import { apiFetch } from "../lib/api";

interface ScoreboardExtractorProps {
  onExtractSuccess: (data: { gameName: string; players: PlayerStats[] }) => void;
  gameConfig: GameConfig;
  currentPlayers: PlayerStats[];
  setCurrentPlayers: React.Dispatch<React.SetStateAction<PlayerStats[]>>;
  calculateRating: (p: { kills: number; deaths: number; assists: number; score: number }) => number;
  registeredPlayers: PlayerHistory[];
  onRefresh: () => void;
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

export default function ScoreboardExtractor({
  onExtractSuccess,
  gameConfig,
  currentPlayers,
  setCurrentPlayers,
  calculateRating,
  registeredPlayers,
  onRefresh,
}: ScoreboardExtractorProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string; base64: string }[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickRegLoading, setQuickRegLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick player select drop downs
  const [selectedRegPlayerToAdd, setSelectedRegPlayerToAdd] = useState("");

  // Handle Drag Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, JPEG).");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setUploadedFiles((prev) => [
        ...prev,
        {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          base64: reader.result as string,
        },
      ]);
      setError(null);
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
    };
  };

  // Handle Drop Event
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);


    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      Array.from(e.dataTransfer.files).forEach(processFile);
    }
  };

  // Handle File Input Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      Array.from(e.target.files).forEach(processFile);
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Call API to perform AI extraction
  const handleAIExtract = async () => {
    if (uploadedFiles.length === 0) return;
    setIsExtracting(true);
    setError(null);

    try {
      const screenshots = uploadedFiles.map((f) => ({
        mimeType: f.base64.split(";")[0].split(":")[1],
        data: f.base64,
      }));

      const res = await apiFetch("/api/gemini/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenshots }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to extract data");
      }

      const data = await res.json();
      
      // Calculate ratings for extracted players
      const mappedPlayers = data.players.map((p: any) => {
        const stats = {
          kills: Number(p.kills || 0),
          deaths: Number(p.deaths || 0),
          assists: Number(p.assists || 0),
          score: Number(p.score || 0),
        };
        
        // Match name with registered player casing if exists
        const regMatch = registeredPlayers.find(rp => rp.displayName.toLowerCase().trim() === p.name.toLowerCase().trim() || rp.name === p.name.toLowerCase().trim());
        const finalName = regMatch ? regMatch.displayName : p.name;

        return {
          name: finalName,
          ...stats,
          rating: calculateRating(stats),
          originalTeam: p.originalTeam || "",
        };
      });

      onExtractSuccess({
        gameName: data.gameName,
        players: mappedPlayers,
      });
      
      setUploadedFiles([]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during scoreboard analysis. Verify your Gemini API Key.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Manual player table controls
  const addManualPlayer = () => {
    const newPlayer: PlayerStats = {
      name: `Player_${currentPlayers.length + 1}`,
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      rating: calculateRating({ kills: 0, deaths: 0, assists: 0, score: 0 }),
    };
    setCurrentPlayers((prev) => [...prev, newPlayer]);
  };

  // Select registered player to add to active match
  const handleAddRegisteredPlayer = (displayName: string) => {
    if (!displayName) return;
    
    // Check if already added
    if (currentPlayers.some(cp => cp.name.toLowerCase().trim() === displayName.toLowerCase().trim())) {
      setSelectedRegPlayerToAdd("");
      return;
    }

    const newPlayer: PlayerStats = {
      name: displayName,
      kills: 0,
      deaths: 0,
      assists: 0,
      score: 0,
      rating: calculateRating({ kills: 0, deaths: 0, assists: 0, score: 0 }),
    };

    setCurrentPlayers((prev) => [...prev, newPlayer]);
    setSelectedRegPlayerToAdd("");
  };

  const updatePlayerField = (index: number, field: keyof PlayerStats, value: any) => {
    setCurrentPlayers((prev) => {
      const copy = [...prev];
      const p = { ...copy[index] };
      
      if (field === "name") {
        p.name = value;
      } else {
        const numVal = Math.max(0, parseInt(value) || 0);
        (p as any)[field] = numVal;
      }
      
      // Recalculate rating on stats change
      p.rating = calculateRating({
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        score: p.score,
      });

      copy[index] = p;
      return copy;
    });
  };

  const removePlayer = (index: number) => {
    setCurrentPlayers((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllPlayers = () => {
    setCurrentPlayers([]);
  };

  // Quick register unregistered players extracted from scoreboard
  const handleQuickRegister = async (name: string, index: number) => {
    setQuickRegLoading(name);
    try {
      // Pick a random preset avatar
      const randomPreset = PRESET_AVATARS[Math.floor(Math.random() * PRESET_AVATARS.length)].id;
      
      const res = await apiFetch("/api/players/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          avatar: randomPreset,
        }),
      });

      if (!res.ok) throw new Error("Failed to quick register.");
      
      onRefresh(); // Refresh parent player registry
      
      // Update roster table to use registered display name
      const registered = await res.json();
      updatePlayerField(index, "name", registered.displayName);
    } catch (err) {
      console.error(err);
    } finally {
      setQuickRegLoading(null);
    }
  };

  // Helper to lookup if a player is registered and return their avatar
  const getPlayerMeta = (name: string) => {
    const matched = registeredPlayers.find(
      (p) => p.displayName.toLowerCase().trim() === name.toLowerCase().trim() || p.name === name.toLowerCase().trim()
    );
    return matched || null;
  };

  // Render mini profile avatar in scoreboard builder rows
  const renderMiniAvatar = (playerMeta: PlayerHistory | null, displayName: string) => {
    if (playerMeta && playerMeta.avatar) {
      if (playerMeta.avatar.startsWith("data:image/")) {
        return (
          <img
            src={playerMeta.avatar}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="w-6 h-6 rounded-full object-cover border border-slate-700"
          />
        );
      }
      const preset = PRESET_AVATARS.find((p) => p.id === playerMeta.avatar);
      if (preset) {
        return (
          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${preset.color} flex items-center justify-center text-[7px] font-bold text-white border border-white/5`}>
            {preset.label.split(" ")[0]}
          </div>
        );
      }
    }
    const initials = displayName.slice(0, 2).toUpperCase();
    return (
      <div className="w-6 h-6 rounded-full bg-slate-800 text-gray-500 border border-slate-700 flex items-center justify-center text-[8px] font-bold">
        {initials || "?"}
      </div>
    );
  };

  return (
    <div id="scoreboard-extractor" className="bg-[#121824] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Cpu className="text-emerald-400 w-5 h-5" /> Scoreboard OCR Extractor
          </h2>
          <p className="text-sm text-gray-400">
            Upload match screenshots to automatically extract statistics using Google Gemini Vision.
          </p>
        </div>
        {currentPlayers.length > 0 && (
          <button
            id="clear-players-btn"
            onClick={clearAllPlayers}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-900/50 text-red-400 bg-red-950/20 hover:bg-red-950/40 transition-colors"
          >
            Clear List
          </button>
        )}
      </div>

      {/* Drag & Drop Area */}
      <div
        id="drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragActive
            ? "border-emerald-500 bg-emerald-500/10 scale-[0.99]"
            : "border-[#1e293b] bg-[#0c0f17]/50 hover:border-slate-700 hover:bg-[#0c0f17]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-[#121824] rounded-full border border-slate-800 text-gray-400">
            <Upload className="w-6 h-6" />
          </div>
          <p className="font-semibold text-gray-200">
            Drag and drop scoreboard screenshots here, or <span className="text-emerald-400">browse files</span>
          </p>
          <p className="text-xs text-gray-400">Supports PNG, JPG, JPEG. Upload multiple to merge multi-page screenshots.</p>
        </div>
      </div>

      {/* Uploaded Files Queue */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3 bg-[#0c0f17] border border-slate-900 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Files to analyze ({uploadedFiles.length})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2.5 bg-[#121824] border border-slate-800 rounded-lg group"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <img
                    src={file.base64}
                    alt={file.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 object-cover rounded border border-slate-700"
                  />
                  <span className="text-xs text-gray-300 font-medium truncate max-w-[120px]">{file.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                  className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-900">
            <button
              id="analyze-screenshots-btn"
              onClick={handleAIExtract}
              disabled={isExtracting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isExtracting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Analyzing Scoreboards...
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" /> Run AI Scoreboard OCR
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 bg-red-950/20 border border-red-900/50 p-4 rounded-lg text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <div className="space-y-1">
            <p className="font-semibold text-red-200">Processing Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Extracted Player List */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0c0f17]/30 p-3 rounded-lg border border-slate-900">
          <h3 className="font-bold text-gray-300 text-sm flex items-center gap-2">
            Active Match Roster ({currentPlayers.length} players)
          </h3>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick add registered dropdown */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase mr-1">Add Registered:</span>
              <select
                value={selectedRegPlayerToAdd}
                onChange={(e) => handleAddRegisteredPlayer(e.target.value)}
                className="bg-[#0c0f17] border border-slate-800 text-xs font-semibold rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
              >
                <option value="">-- Choose Legend --</option>
                {registeredPlayers
                  .filter(rp => !currentPlayers.some(cp => cp.name.toLowerCase().trim() === rp.displayName.toLowerCase().trim() || cp.name.toLowerCase().trim() === rp.name))
                  .map(rp => (
                    <option key={rp.name} value={rp.displayName}>
                      {rp.displayName}
                    </option>
                  ))
                }
              </select>
            </div>

            <button
              id="add-manual-player-btn"
              onClick={addManualPlayer}
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300 bg-slate-900 hover:bg-slate-800 transition-all"
            >
              <Plus className="w-3 h-3" /> Custom Row
            </button>
          </div>
        </div>

        {currentPlayers.length === 0 ? (
          <div className="text-center py-10 border border-[#1e293b] border-dashed rounded-lg bg-[#0c0f17]/30">
            <p className="text-gray-500 text-sm">No players added to the active roster yet.</p>
            <p className="text-gray-600 text-xs mt-1">Upload scoreboards above or add players from the select list to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-900">
            <table className="w-full text-left text-sm border-collapse bg-[#0c0f17]/50">
              <thead>
                <tr className="bg-[#121824] text-gray-400 text-xs uppercase tracking-wider font-bold">
                  <th className="py-3 px-4">Player Gamer Tag</th>
                  <th className={`py-3 px-4 w-24 transition-opacity ${gameConfig.scoreOnly ? "opacity-30" : ""}`}>
                    Kills {gameConfig.scoreOnly && <span className="text-[8px] block text-gray-500 lowercase font-normal leading-tight">(unused)</span>}
                  </th>
                  <th className={`py-3 px-4 w-24 transition-opacity ${gameConfig.scoreOnly ? "opacity-30" : ""}`}>
                    Deaths {gameConfig.scoreOnly && <span className="text-[8px] block text-gray-500 lowercase font-normal leading-tight">(unused)</span>}
                  </th>
                  <th className={`py-3 px-4 w-24 transition-opacity ${gameConfig.scoreOnly ? "opacity-30" : ""}`}>
                    Assists {gameConfig.scoreOnly && <span className="text-[8px] block text-gray-500 lowercase font-normal leading-tight">(unused)</span>}
                  </th>
                  <th className="py-3 px-4 w-24 text-emerald-400 font-extrabold">
                    Score {gameConfig.scoreOnly && <span className="text-[8px] block text-emerald-500/80 font-black tracking-wider leading-tight">(ACTIVE)</span>}
                  </th>
                  <th className="py-3 px-4 w-28">Calc. Rating</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {currentPlayers.map((player, index) => {
                  const playerMeta = getPlayerMeta(player.name);
                  const isRegistered = playerMeta !== null;
                  const isSuspicious = gameConfig.scoreOnly 
                    ? player.score === 0 
                    : (player.kills === 0 && player.deaths === 0 && player.score === 0);

                  return (
                    <tr
                      key={index}
                      className={`hover:bg-[#121824]/40 transition-colors ${
                        isSuspicious ? "bg-amber-950/10 border-l-2 border-l-amber-500" : ""
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {renderMiniAvatar(playerMeta, player.name)}
                          
                          <div className="flex-1 space-y-1">
                            <input
                              type="text"
                              value={player.name}
                              onChange={(e) => updatePlayerField(index, "name", e.target.value)}
                              className="w-full bg-[#121824] border border-slate-800 rounded px-2 py-1 text-white font-medium text-xs focus:outline-none focus:border-emerald-500/50"
                              placeholder="Gamer Tag"
                            />
                            
                            {/* Validation Badge */}
                            {isRegistered ? (
                              <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5 leading-none mt-0.5">
                                <UserCheck className="w-3 h-3" /> Registered Legend
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-amber-500 font-bold flex items-center gap-0.5 leading-none">
                                  <HelpCircle className="w-3 h-3" /> Unregistered
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleQuickRegister(player.name, index)}
                                  disabled={quickRegLoading === player.name || !player.name.trim()}
                                  className="text-[8px] font-black uppercase text-blue-400 hover:text-blue-300 cursor-pointer disabled:opacity-40"
                                >
                                  {quickRegLoading === player.name ? "Registering..." : "+ Quick Register"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`py-2.5 px-4 transition-opacity ${gameConfig.scoreOnly ? "opacity-25" : ""}`}>
                        <input
                          type="number"
                          value={player.kills}
                          disabled={gameConfig.scoreOnly}
                          onChange={(e) => updatePlayerField(index, "kills", e.target.value)}
                          className="w-full bg-[#121824] border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                          min="0"
                        />
                      </td>
                      <td className={`py-2.5 px-4 transition-opacity ${gameConfig.scoreOnly ? "opacity-25" : ""}`}>
                        <input
                          type="number"
                          value={player.deaths}
                          disabled={gameConfig.scoreOnly}
                          onChange={(e) => updatePlayerField(index, "deaths", e.target.value)}
                          className="w-full bg-[#121824] border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                          min="0"
                        />
                      </td>
                      <td className={`py-2.5 px-4 transition-opacity ${gameConfig.scoreOnly ? "opacity-25" : ""}`}>
                        <input
                          type="number"
                          value={player.assists}
                          disabled={gameConfig.scoreOnly}
                          onChange={(e) => updatePlayerField(index, "assists", e.target.value)}
                          className="w-full bg-[#121824] border border-slate-800 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                          min="0"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          value={player.score}
                          onChange={(e) => updatePlayerField(index, "score", e.target.value)}
                          className="w-full bg-[#121824] border border-slate-800 rounded px-2 py-1 text-emerald-400 font-mono font-bold text-xs focus:outline-none focus:border-emerald-500/50"
                          min="0"
                        />
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-400">
                        {player.rating}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => removePlayer(index)}
                          className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-slate-900 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
