import React, { useState, useEffect } from "react";
import { Users, Shuffle, ArrowLeftRight, Check, Copy, Save, Award, Sparkles, FileText, Lock, EyeOff } from "lucide-react";
import { PlayerStats, TeamSplit, GameConfig, PlayerHistory } from "../types";
import { apiFetch } from "../lib/api";

interface TeamGeneratorProps {
  currentPlayers: PlayerStats[];
  gameConfig: GameConfig;
  registeredPlayers: PlayerHistory[];
  onSaveMatchSuccess: () => void;
}

const PRESET_AVATARS = [
  { id: "phoenix", label: "🔥 Phoenix", color: "from-orange-500 to-red-600" },
  { id: "sage", label: "🌿 Sage", color: "from-emerald-400 to-teal-600" },
  { id: "jett", label: "🌪️ Jett", color: "from-sky-400 to-indigo-500" },
  { id: "reyna", label: "😈 Reyna", color: "from-purple-500 to-fuchsia-700" },
  { id: "omen", label: "🌌 Omen", color: "from-slate-700 to-slate-900" },
  { id: "cypher", label: "🕵️ Cypher", color: "from-amber-500 to-orange-600" },
  { id: "neon", label: "⚡ Neon", color: "from-cyan-400 to-blue-600" },
  { id: "raze", label: "💣 Raze", color: "from-yellow-500 to-red-500" },
];

export default function TeamGenerator({
  currentPlayers,
  gameConfig,
  registeredPlayers,
  onSaveMatchSuccess,
}: TeamGeneratorProps) {
  const [teamSplit, setTeamSplit] = useState<TeamSplit | null>(null);
  const [isBalancing, setIsBalancing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto balance on player load or config change
  const triggerBalance = async () => {
    if (currentPlayers.length === 0) return;
    setIsBalancing(true);
    setSaveStatus(null);
    try {
      const res = await apiFetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: currentPlayers,
          gameId: gameConfig.id,
        }),
      });

      if (!res.ok) throw new Error("Failed to balance teams");
      const data = await res.json();
      setTeamSplit({
        teamA: data.teamA,
        teamB: data.teamB,
        totalRatingA: data.totalRatingA,
        totalRatingB: data.totalRatingB,
        difference: data.difference,
        sizeDiff: data.sizeDiff,
        constraintsSatisfied: data.constraintsSatisfied,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsBalancing(false);
    }
  };

  useEffect(() => {
    if (currentPlayers.length > 0) {
      triggerBalance();
    } else {
      setTeamSplit(null);
    }
  }, [currentPlayers, gameConfig]);

  // Manually swap a player to the opposite team
  const handleMovePlayer = (playerName: string, currentTeam: "A" | "B") => {
    if (!teamSplit) return;

    let pToMove: PlayerStats | undefined;
    let newTeamA = [...teamSplit.teamA];
    let newTeamB = [...teamSplit.teamB];

    if (currentTeam === "A") {
      pToMove = newTeamA.find((p) => p.name === playerName);
      if (pToMove) {
        newTeamA = newTeamA.filter((p) => p.name !== playerName);
        newTeamB.push(pToMove);
      }
    } else {
      pToMove = newTeamB.find((p) => p.name === playerName);
      if (pToMove) {
        newTeamB = newTeamB.filter((p) => p.name !== playerName);
        newTeamA.push(pToMove);
      }
    }

    const totalA = parseFloat(newTeamA.reduce((sum, p) => sum + p.rating, 0).toFixed(1));
    const totalB = parseFloat(newTeamB.reduce((sum, p) => sum + p.rating, 0).toFixed(1));
    const diff = parseFloat(Math.abs(totalA - totalB).toFixed(1));

    setTeamSplit({
      teamA: newTeamA,
      teamB: newTeamB,
      totalRatingA: totalA,
      totalRatingB: totalB,
      difference: diff,
      sizeDiff: Math.abs(newTeamA.length - newTeamB.length),
      constraintsSatisfied: false, // User manual overrides bypass constraints
    });
  };

  // Copy teams to clipboard
  const handleCopyTeams = () => {
    if (!teamSplit) return;

    const formatTeam = (teamName: string, players: PlayerStats[], total: number) => {
      const pList = players
        .map((p) => `• ${p.name} (K/D: ${p.kills}/${p.deaths} | Rating: ${p.rating})`)
        .join("\n");
      return `=== ${teamName} (Total Rating: ${total}) ===\n${pList}`;
    };

    const text = `${formatTeam("TEAM ALPHA", teamSplit.teamA, teamSplit.totalRatingA)}\n\n${formatTeam(
      "TEAM OMEGA",
      teamSplit.teamB,
      teamSplit.totalRatingB
    )}\n\nDifference: ${teamSplit.difference} points\nBalanced via Multiplayer Team Balancer`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save match to backend database
  const handleSaveMatch = async () => {
    if (!teamSplit) return;
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const matchData = {
        gameId: gameConfig.id,
        gameName: gameConfig.name,
        screenshotsCount: 0, // Placeholder
        players: currentPlayers,
        teams: {
          teamA: {
            players: teamSplit.teamA,
            totalRating: teamSplit.totalRatingA,
          },
          teamB: {
            players: teamSplit.teamB,
            totalRating: teamSplit.totalRatingB,
          },
          difference: teamSplit.difference,
        },
      };

      const res = await apiFetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchData),
      });

      if (!res.ok) throw new Error("Failed to save match data.");

      setSaveStatus({ type: "success", message: "Match score and balanced teams logged successfully!" });
      onSaveMatchSuccess();
    } catch (err: any) {
      setSaveStatus({ type: "error", message: err.message || "Failed to save match data" });
    } finally {
      setIsSaving(false);
    }
  };

  if (currentPlayers.length === 0) return null;

  // Check relationship flags in active roster for visualization
  const getPlayerRelations = (name: string) => {
    const pHistory = registeredPlayers.find((p) => p.displayName.toLowerCase().trim() === name.toLowerCase().trim() || p.name === name.toLowerCase().trim());
    return {
      locks: pHistory?.lockedWith || [],
      opposites: pHistory?.forcedOpposite || [],
      avatar: pHistory?.avatar || "",
      displayName: pHistory?.displayName || name,
    };
  };

  // Inline avatar renderer helper
  const renderInlineAvatar = (avatar: string, displayName: string) => {
    if (avatar && avatar.startsWith("data:image/")) {
      return (
        <img
          src={avatar}
          alt={displayName}
          referrerPolicy="no-referrer"
          className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0"
        />
      );
    }

    const preset = PRESET_AVATARS.find((p) => p.id === avatar);
    if (preset) {
      return (
        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${preset.color} flex items-center justify-center text-[7px] font-bold text-white shrink-0 border border-white/5`}>
          {preset.label.split(" ")[0]}
        </div>
      );
    }

    const initials = displayName.slice(0, 2).toUpperCase();
    return (
      <div className="w-6 h-6 rounded-full bg-slate-800 text-gray-500 border border-slate-700 flex items-center justify-center text-[8px] font-bold shrink-0">
        {initials || "?"}
      </div>
    );
  };

  return (
    <div id="team-generator-card" className="bg-[#121824] border border-[#1e293b] rounded-xl p-6 shadow-2xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-900 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="text-blue-400 w-5 h-5" /> Balanced Match Generator
          </h2>
          <p className="text-sm text-gray-400">
            Current Game: <span className="text-white font-semibold">{gameConfig.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="recalculate-btn"
            onClick={triggerBalance}
            disabled={isBalancing}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-800 text-slate-300 bg-slate-900 hover:bg-slate-850 transition-all cursor-pointer disabled:opacity-50"
          >
            <Shuffle className={`w-3.5 h-3.5 ${isBalancing ? "animate-spin" : ""}`} /> Reroll Balances
          </button>

          <button
            id="copy-teams-btn"
            onClick={handleCopyTeams}
            disabled={!teamSplit}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-800 text-slate-300 bg-slate-900 hover:bg-slate-850 transition-all cursor-pointer disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Export Teams
              </>
            )}
          </button>

          <button
            id="save-match-btn"
            onClick={handleSaveMatch}
            disabled={!teamSplit || isSaving}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-505 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {isSaving ? "Saving..." : "Log Match History"}
          </button>
        </div>
      </div>

      {/* Save Success / Error Toast message */}
      {saveStatus && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg text-sm border ${
            saveStatus.type === "success"
              ? "bg-emerald-950/20 border-emerald-900/55 text-emerald-300"
              : "bg-red-950/20 border-red-900/55 text-red-300"
          }`}
        >
          {saveStatus.type === "success" ? <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" /> : <EyeOff className="w-5 h-5 text-red-400 shrink-0" />}
          <p className="font-semibold">{saveStatus.message}</p>
        </div>
      )}

      {teamSplit ? (
        <div className="space-y-6">
          {/* Rating Spread Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0c0f17] border border-slate-900 p-4 rounded-xl">
            <div className="text-center md:text-left border-b md:border-b-0 md:border-r border-slate-900 pb-3 md:pb-0 md:pr-4">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Alpha Rating</span>
              <p className="text-2xl font-black font-mono text-blue-400 mt-1">{teamSplit.totalRatingA}</p>
            </div>
            <div className="text-center md:text-left border-b md:border-b-0 md:border-r border-slate-900 py-3 md:py-0 md:px-4">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Omega Rating</span>
              <p className="text-2xl font-black font-mono text-purple-400 mt-1">{teamSplit.totalRatingB}</p>
            </div>
            <div className="text-center md:text-left pt-3 md:pt-0 md:pl-4">
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Spread Difference</span>
              <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                <p className="text-2xl font-black font-mono text-amber-400">{teamSplit.difference}</p>
                <span className="text-xs bg-amber-950/40 border border-amber-900/30 text-amber-300 px-1.5 py-0.5 rounded font-bold font-mono">
                  {teamSplit.difference <= 5 ? "PERFECT" : teamSplit.difference <= 15 ? "BALANCED" : "OK"}
                </span>
              </div>
            </div>
          </div>

          {/* Constraints warning if applicable */}
          {!teamSplit.constraintsSatisfied && (
            <div className="bg-amber-950/10 border border-amber-900/40 p-3 rounded-lg text-xs text-amber-300 flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                Note: Constraints (locks/opposites) might not be fully satisfied or manual edits have overridden them.
              </span>
            </div>
          )}

          {/* Teams Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Alpha */}
            <div className="border border-blue-900/30 bg-gradient-to-b from-blue-950/10 to-transparent rounded-xl overflow-hidden shadow-lg">
              <div className="bg-blue-950/30 border-b border-blue-900/30 px-4 py-3 flex justify-between items-center">
                <span className="font-extrabold text-blue-400 tracking-wider text-sm flex items-center gap-2">
                  <Award className="w-4 h-4" /> TEAM ALPHA
                </span>
                <span className="text-xs font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-900/50">
                  {teamSplit.teamA.length} Players
                </span>
              </div>

              <div className="p-4 space-y-3">
                {teamSplit.teamA.map((player) => {
                  const relations = getPlayerRelations(player.name);
                  return (
                    <div
                      key={player.name}
                      className="flex items-center justify-between p-3 bg-[#0c0f17]/60 border border-slate-900 rounded-lg hover:border-blue-900/30 transition-all group"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {renderInlineAvatar(relations.avatar, relations.displayName)}
                        <div className="space-y-1 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white text-sm truncate">{relations.displayName}</p>
                            {relations.locks.length > 0 && (
                              <span title={`Locked with: ${relations.locks.join(", ")}`} className="text-emerald-400 cursor-help">
                                <Lock className="w-3 h-3" />
                              </span>
                            )}
                            {relations.opposites.length > 0 && (
                              <span title={`Forced opposite to: ${relations.opposites.join(", ")}`} className="text-red-400 cursor-help">
                                <EyeOff className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-gray-500">
                            K/D/A: <span className="text-gray-300">{player.kills}</span> /{" "}
                            <span className="text-gray-300">{player.deaths}</span> /{" "}
                            <span className="text-gray-300">{player.assists}</span> &nbsp;|&nbsp; Score:{" "}
                            <span className="text-gray-300">{player.score}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 font-bold font-mono">RATING</p>
                          <p className="text-sm font-black font-mono text-emerald-400">{player.rating}</p>
                        </div>
                        <button
                          title="Move to Team Omega"
                          onClick={() => handleMovePlayer(player.name, "A")}
                          className="p-1.5 text-gray-500 hover:text-blue-400 bg-slate-900 hover:bg-slate-850 rounded border border-slate-800 transition-colors cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Team Omega */}
            <div className="border border-purple-900/30 bg-gradient-to-b from-purple-950/10 to-transparent rounded-xl overflow-hidden shadow-lg">
              <div className="bg-purple-950/30 border-b border-purple-900/30 px-4 py-3 flex justify-between items-center">
                <span className="font-extrabold text-purple-400 tracking-wider text-sm flex items-center gap-2">
                  <Award className="w-4 h-4" /> TEAM OMEGA
                </span>
                <span className="text-xs font-mono bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-900/50">
                  {teamSplit.teamB.length} Players
                </span>
              </div>

              <div className="p-4 space-y-3">
                {teamSplit.teamB.map((player) => {
                  const relations = getPlayerRelations(player.name);
                  return (
                    <div
                      key={player.name}
                      className="flex items-center justify-between p-3 bg-[#0c0f17]/60 border border-slate-900 rounded-lg hover:border-purple-900/30 transition-all group"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {renderInlineAvatar(relations.avatar, relations.displayName)}
                        <div className="space-y-1 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white text-sm truncate">{relations.displayName}</p>
                            {relations.locks.length > 0 && (
                              <span title={`Locked with: ${relations.locks.join(", ")}`} className="text-emerald-400 cursor-help">
                                <Lock className="w-3 h-3" />
                              </span>
                            )}
                            {relations.opposites.length > 0 && (
                              <span title={`Forced opposite to: ${relations.opposites.join(", ")}`} className="text-red-400 cursor-help">
                                <EyeOff className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-gray-500">
                            K/D/A: <span className="text-gray-300">{player.kills}</span> /{" "}
                            <span className="text-gray-300">{player.deaths}</span> /{" "}
                            <span className="text-gray-300">{player.assists}</span> &nbsp;|&nbsp; Score:{" "}
                            <span className="text-gray-300">{player.score}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 font-bold font-mono">RATING</p>
                          <p className="text-sm font-black font-mono text-emerald-400">{player.rating}</p>
                        </div>
                        <button
                          title="Move to Team Alpha"
                          onClick={() => handleMovePlayer(player.name, "B")}
                          className="p-1.5 text-gray-500 hover:text-purple-400 bg-slate-900 hover:bg-slate-850 rounded border border-slate-800 transition-colors cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10">
          <Shuffle className="w-8 h-8 text-slate-700 animate-pulse mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Please insert or extract players to generate balanced matchups.</p>
        </div>
      )}
    </div>
  );
}
