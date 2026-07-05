import React, { useState, useEffect } from "react";
import { Users, Shuffle, ArrowLeftRight, Check, Copy, Save, Award, Sparkles, FileText, Lock, EyeOff, AlertCircle, X } from "lucide-react";
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

  // New customization states
  const [matchFormat, setMatchFormat] = useState<"all" | "2v2" | "3v3" | "4v4">("all");
  const [generationMode, setGenerationMode] = useState<"balanced" | "random">("balanced");
  const [benchPlayers, setBenchPlayers] = useState<PlayerStats[]>([]);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Match results entry states
  const [showResultsForm, setShowResultsForm] = useState(false);
  const [gameMode, setGameMode] = useState<"Hardpoint" | "Search & Destroy">("Hardpoint");
  const [scoreA, setScoreA] = useState<number | "">("");
  const [scoreB, setScoreB] = useState<number | "">("");
  const [playerStatsInput, setPlayerStatsInput] = useState<{
    [playerName: string]: { kills: number; deaths: number };
  }>({});

  // Auto balance on player load or config change
  const triggerBalance = async () => {
    if (currentPlayers.length === 0) return;
    setIsBalancing(true);
    setSaveStatus(null);
    setBalanceError(null);
    setBenchPlayers([]);

    let targetCount = currentPlayers.length;
    if (matchFormat === "2v2") targetCount = 4;
    if (matchFormat === "3v3") targetCount = 6;
    if (matchFormat === "4v4") targetCount = 8;

    if (currentPlayers.length < targetCount) {
      setIsBalancing(false);
      setTeamSplit(null);
      setBalanceError(null);
      return;
    }

    let playing: PlayerStats[] = [];
    let benched: PlayerStats[] = [];

    if (matchFormat === "all") {
      playing = [...currentPlayers];
    } else {
      if (generationMode === "balanced") {
        // Sort by rating to grab the highest rated players for the match
        const sorted = [...currentPlayers].sort((a, b) => b.rating - a.rating);
        playing = sorted.slice(0, targetCount);
        benched = sorted.slice(targetCount);
      } else {
        // Randomly select playing players
        const shuffled = [...currentPlayers];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        playing = shuffled.slice(0, targetCount);
        benched = shuffled.slice(targetCount);
      }
    }

    setBenchPlayers(benched);

    if (generationMode === "balanced") {
      try {
        const res = await apiFetch("/api/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            players: playing,
            gameId: gameConfig.id,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to balance teams");
        }
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
      } catch (err: any) {
        console.error(err);
        setBalanceError(err.message || "Failed to contact the matchmaking server. Please ensure the dev server is running.");
        setTeamSplit(null);
      } finally {
        setIsBalancing(false);
      }
    } else {
      // Randomized split
      const shuffledPlaying = [...playing];
      for (let i = shuffledPlaying.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPlaying[i], shuffledPlaying[j]] = [shuffledPlaying[j], shuffledPlaying[i]];
      }

      const half = Math.ceil(shuffledPlaying.length / 2);
      const teamA = shuffledPlaying.slice(0, half);
      const teamB = shuffledPlaying.slice(half);

      const totalRatingA = parseFloat(teamA.reduce((sum, p) => sum + p.rating, 0).toFixed(1));
      const totalRatingB = parseFloat(teamB.reduce((sum, p) => sum + p.rating, 0).toFixed(1));
      const difference = parseFloat(Math.abs(totalRatingA - totalRatingB).toFixed(1));

      setTeamSplit({
        teamA,
        teamB,
        totalRatingA,
        totalRatingB,
        difference,
        sizeDiff: Math.abs(teamA.length - teamB.length),
        constraintsSatisfied: true,
      });
      setIsBalancing(false);
    }
  };

  useEffect(() => {
    if (currentPlayers.length > 0) {
      triggerBalance();
    } else {
      setTeamSplit(null);
      setBenchPlayers([]);
      setBalanceError(null);
    }
  }, [currentPlayers, gameConfig, matchFormat, generationMode]);

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

  // Helper to calculate rating based on game weight configuration
  const calculatePlayerRating = (kills: number, deaths: number, assists: number, score: number) => {
    if (gameConfig.scoreOnly) {
      const rating = gameConfig.baseRating + score * gameConfig.scoreWeight;
      return Math.max(0, parseFloat(rating.toFixed(1)));
    }
    const rating =
      gameConfig.baseRating +
      kills * gameConfig.killsWeight +
      assists * gameConfig.assistsWeight +
      score * gameConfig.scoreWeight -
      deaths * gameConfig.deathsWeight;
    return Math.max(0, parseFloat(rating.toFixed(1)));
  };

  // Open the results entry form modal
  const openResultsForm = () => {
    if (!teamSplit) return;
    const initialStats: typeof playerStatsInput = {};
    [...teamSplit.teamA, ...teamSplit.teamB].forEach((p) => {
      initialStats[playerStatsKey(p.name)] = { kills: 0, deaths: 0 };
    });
    setPlayerStatsInput(initialStats);
    setScoreA("");
    setScoreB("");
    setShowResultsForm(true);
  };

  // Helper key normalization for player stats lookup
  const playerStatsKey = (name: string) => name.toLowerCase().trim();

  // Submit match results manually typed
  const submitMatchResults = async () => {
    if (!teamSplit || scoreA === "" || scoreB === "") return;
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const mapPlayersWithTypedStats = (playersList: PlayerStats[], teamLabel: string) => {
        return playersList.map((p) => {
          const typed = playerStatsInput[playerStatsKey(p.name)] || { kills: 0, deaths: 0 };
          const kills = typed.kills;
          const deaths = typed.deaths;
          const assists = 0;
          const score = 0;
          const rating = calculatePlayerRating(kills, deaths, assists, score);
          return {
            ...p,
            kills,
            deaths,
            assists,
            score,
            rating,
            team: teamLabel
          };
        });
      };

      const finalTeamA = mapPlayersWithTypedStats(teamSplit.teamA, "teamA");
      const finalTeamB = mapPlayersWithTypedStats(teamSplit.teamB, "teamB");

      const matchData = {
        gameId: gameConfig.id,
        gameName: gameConfig.name,
        screenshotsCount: 0,
        players: [...finalTeamA, ...finalTeamB],
        gameMode,
        teamAScore: Number(scoreA),
        teamBScore: Number(scoreB),
        teams: {
          teamA: {
            players: finalTeamA,
            totalRating: parseFloat(finalTeamA.reduce((sum, p) => sum + p.rating, 0).toFixed(1)),
            score: Number(scoreA),
          },
          teamB: {
            players: finalTeamB,
            totalRating: parseFloat(finalTeamB.reduce((sum, p) => sum + p.rating, 0).toFixed(1)),
            score: Number(scoreB),
          },
          difference: parseFloat(
            Math.abs(
              finalTeamA.reduce((sum, p) => sum + p.rating, 0) -
              finalTeamB.reduce((sum, p) => sum + p.rating, 0)
            ).toFixed(1)
          ),
        },
      };

      const res = await apiFetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchData),
      });

      if (!res.ok) throw new Error("Failed to save match data.");

      setSaveStatus({ type: "success", message: `Match logged successfully! ${gameMode}: ${scoreA} - ${scoreB}` });
      setShowResultsForm(false);
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

  const neededPlayers = matchFormat === "2v2" ? 4 : matchFormat === "3v3" ? 6 : matchFormat === "4v4" ? 8 : 0;
  const hasEnoughPlayers = currentPlayers.length >= neededPlayers;

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
            disabled={isBalancing || !hasEnoughPlayers}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-800 text-slate-300 bg-slate-900 hover:bg-slate-850 transition-all cursor-pointer disabled:opacity-50 animate-fade-in"
          >
            <Shuffle className={`w-3.5 h-3.5 ${isBalancing ? "animate-spin" : ""}`} /> Reroll Balances
          </button>

          <button
            id="copy-teams-btn"
            onClick={handleCopyTeams}
            disabled={!teamSplit || !hasEnoughPlayers}
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
            onClick={openResultsForm}
            disabled={!teamSplit || isSaving || !hasEnoughPlayers}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-505 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> Log Match Results
          </button>
        </div>
      </div>

      {/* Control selectors for mode and size */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0c0f17]/40 p-4 rounded-xl border border-slate-900">
        {/* Generation Mode Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Generation Mode</label>
          <div className="flex bg-[#0c0f17] p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setGenerationMode("balanced")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all ${
                generationMode === "balanced"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Skill-Balanced
            </button>
            <button
              onClick={() => setGenerationMode("random")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all ${
                generationMode === "random"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Randomized
            </button>
          </div>
        </div>

        {/* Match Format Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Match Format</label>
          <div className="flex bg-[#0c0f17] p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setMatchFormat("all")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all ${
                matchFormat === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Roster Default
            </button>
            <button
              onClick={() => setMatchFormat("2v2")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all ${
                matchFormat === "2v2"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              2v2 Match
            </button>
            <button
              onClick={() => setMatchFormat("3v3")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all ${
                matchFormat === "3v3"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              3v3 Match
            </button>
            <button
              onClick={() => setMatchFormat("4v4")}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all ${
                matchFormat === "4v4"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              4v4 Match
            </button>
          </div>
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

      {/* Warning for insufficient players */}
      {!hasEnoughPlayers && (
        <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-xl text-center space-y-2">
          <p className="text-sm font-semibold text-red-350">
            ⚠️ Insufficient Players for Match Format
          </p>
          <p className="text-xs text-gray-400">
            You need at least {neededPlayers} players in the active roster to generate a {matchFormat} match. 
            Currently you have {currentPlayers.length} players.
          </p>
        </div>
      )}

      {/* Error message for matchmaking failures */}
      {hasEnoughPlayers && balanceError && (
        <div className="bg-red-950/20 border border-red-900/40 p-4 rounded-xl text-center space-y-2">
          <p className="text-sm font-semibold text-red-350 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" /> Matchmaker Offline / Error
          </p>
          <p className="text-xs text-gray-400">
            {balanceError}
          </p>
        </div>
      )}

      {hasEnoughPlayers && teamSplit ? (
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
          {generationMode === "balanced" && !teamSplit.constraintsSatisfied && (
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
                            {generationMode === "balanced" && relations.locks.length > 0 && (
                              <span title={`Locked with: ${relations.locks.join(", ")}`} className="text-emerald-400 cursor-help">
                                <Lock className="w-3 h-3" />
                              </span>
                            )}
                            {generationMode === "balanced" && relations.opposites.length > 0 && (
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
                            {generationMode === "balanced" && relations.locks.length > 0 && (
                              <span title={`Locked with: ${relations.locks.join(", ")}`} className="text-emerald-400 cursor-help">
                                <Lock className="w-3 h-3" />
                              </span>
                            )}
                            {generationMode === "balanced" && relations.opposites.length > 0 && (
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

          {/* Bench / Substitutes Section */}
          {benchPlayers.length > 0 && (
            <div className="border border-slate-900 bg-[#0c0f17]/40 rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Substitutes / Bench ({benchPlayers.length})
              </span>
              <div className="flex flex-wrap gap-2.5">
                {benchPlayers.map((player) => {
                  const relations = getPlayerRelations(player.name);
                  return (
                    <div
                      key={player.name}
                      className="flex items-center gap-2 py-1.5 px-3 bg-[#121824] border border-slate-800 rounded-lg text-xs"
                    >
                      {renderInlineAvatar(relations.avatar, relations.displayName)}
                      <span className="font-semibold text-gray-300">{relations.displayName}</span>
                      <span className="text-gray-500 font-mono text-[10px]">({player.rating})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : hasEnoughPlayers && (
        <div className="text-center py-10">
          <Shuffle className="w-8 h-8 text-slate-700 animate-pulse mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Please insert or extract players to generate balanced matchups.</p>
        </div>
      )}

      {/* Match Results Entry Modal */}
      {showResultsForm && teamSplit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#0e1320] border border-slate-800 rounded-xl shadow-2xl overflow-hidden p-6 my-8 space-y-6 animate-fade-in">
            {/* Corner Brackets */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500/60 rounded-tl" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500/60 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500/60 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500/60 rounded-br" />

            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Award className="text-blue-400 w-5 h-5" /> Log Match Results
              </h3>
              <button
                onClick={() => setShowResultsForm(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Game Mode and Scores */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#0c0f17]/60 p-4 rounded-xl border border-slate-900">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">
                  Game Mode
                </label>
                <select
                  value={gameMode}
                  onChange={(e) => {
                    const mode = e.target.value as "Hardpoint" | "Search & Destroy";
                    setGameMode(mode);
                    setScoreA("");
                    setScoreB("");
                  }}
                  className="w-full bg-[#121620] border border-slate-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-white text-sm focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="Hardpoint">Hardpoint (Max 250)</option>
                  <option value="Search & Destroy">Search & Destroy (Max 6)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">
                  Team Alpha Score
                </label>
                <input
                  type="number"
                  min="0"
                  max={gameMode === "Hardpoint" ? 250 : 6}
                  value={scoreA}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0);
                    const maxVal = gameMode === "Hardpoint" ? 250 : 6;
                    if (val === "" || val <= maxVal) {
                      setScoreA(val);
                    }
                  }}
                  placeholder={`Max ${gameMode === "Hardpoint" ? 250 : 6}`}
                  className="w-full bg-[#121620] border border-slate-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">
                  Team Omega Score
                </label>
                <input
                  type="number"
                  min="0"
                  max={gameMode === "Hardpoint" ? 250 : 6}
                  value={scoreB}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0);
                    const maxVal = gameMode === "Hardpoint" ? 250 : 6;
                    if (val === "" || val <= maxVal) {
                      setScoreB(val);
                    }
                  }}
                  placeholder={`Max ${gameMode === "Hardpoint" ? 250 : 6}`}
                  className="w-full bg-[#121620] border border-slate-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Player Stats Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
              {/* Team Alpha Inputs */}
              <div className="space-y-3">
                <div className="border-b border-blue-900/30 pb-1.5">
                  <span className="font-extrabold text-blue-400 tracking-wider text-xs">
                    TEAM ALPHA PLAYERS
                  </span>
                </div>
                <div className="space-y-3">
                  {teamSplit.teamA.map((player) => (
                    <div key={player.name} className="flex items-center justify-between gap-3 bg-[#0c0f17]/40 p-2.5 rounded-lg border border-slate-900">
                      <span className="text-sm font-semibold text-white truncate max-w-[120px]">
                        {player.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 font-bold font-mono">K:</span>
                          <input
                            type="number"
                            min="0"
                            value={playerStatsInput[playerStatsKey(player.name)]?.kills ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setPlayerStatsInput(prev => ({
                                ...prev,
                                [playerStatsKey(player.name)]: { ...prev[playerStatsKey(player.name)], kills: val }
                              }));
                            }}
                            className="w-12 bg-[#121620] border border-slate-800 focus:border-emerald-500/50 rounded-lg px-1.5 py-1 text-white text-xs font-mono text-center focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 font-bold font-mono">D:</span>
                          <input
                            type="number"
                            min="0"
                            value={playerStatsInput[playerStatsKey(player.name)]?.deaths ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setPlayerStatsInput(prev => ({
                                ...prev,
                                [playerStatsKey(player.name)]: { ...prev[playerStatsKey(player.name)], deaths: val }
                              }));
                            }}
                            className="w-12 bg-[#121620] border border-slate-800 focus:border-emerald-500/50 rounded-lg px-1.5 py-1 text-white text-xs font-mono text-center focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Omega Inputs */}
              <div className="space-y-3">
                <div className="border-b border-purple-900/30 pb-1.5">
                  <span className="font-extrabold text-purple-400 tracking-wider text-xs">
                    TEAM OMEGA PLAYERS
                  </span>
                </div>
                <div className="space-y-3">
                  {teamSplit.teamB.map((player) => (
                    <div key={player.name} className="flex items-center justify-between gap-3 bg-[#0c0f17]/40 p-2.5 rounded-lg border border-slate-900">
                      <span className="text-sm font-semibold text-white truncate max-w-[120px]">
                        {player.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 font-bold font-mono">K:</span>
                          <input
                            type="number"
                            min="0"
                            value={playerStatsInput[playerStatsKey(player.name)]?.kills ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setPlayerStatsInput(prev => ({
                                ...prev,
                                [playerStatsKey(player.name)]: { ...prev[playerStatsKey(player.name)], kills: val }
                              }));
                            }}
                            className="w-12 bg-[#121620] border border-slate-800 focus:border-emerald-500/50 rounded-lg px-1.5 py-1 text-white text-xs font-mono text-center focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 font-bold font-mono">D:</span>
                          <input
                            type="number"
                            min="0"
                            value={playerStatsInput[playerStatsKey(player.name)]?.deaths ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setPlayerStatsInput(prev => ({
                                ...prev,
                                [playerStatsKey(player.name)]: { ...prev[playerStatsKey(player.name)], deaths: val }
                              }));
                            }}
                            className="w-12 bg-[#121620] border border-slate-800 focus:border-emerald-500/50 rounded-lg px-1.5 py-1 text-white text-xs font-mono text-center focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 border-t border-slate-900 pt-4">
              <button
                onClick={() => setShowResultsForm(false)}
                className="px-4 py-2 rounded-lg border border-slate-850 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitMatchResults}
                disabled={isSaving || scoreA === "" || scoreB === ""}
                className="flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Submit & Save Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
