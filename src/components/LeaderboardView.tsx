import React, { useState } from "react";
import { Trophy, Medal, Star, ArrowUp, Flame, Search, Gamepad2, TrendingUp, Sparkles, Award } from "lucide-react";
import { PlayerHistory, GameConfig } from "../types";

interface LeaderboardViewProps {
  players: PlayerHistory[];
  games: GameConfig[];
  activeGameId: string;
  onSetActiveGame: (gameId: string) => void;
}

// Preset avatars colors matching those in registration
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

export default function LeaderboardView({
  players,
  games,
  activeGameId,
  onSetActiveGame,
}: LeaderboardViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"rating" | "matches" | "kills" | "score">("rating");

  const activeGame = games.find((g) => g.id === activeGameId) || games[0];

  // Helper to render beautiful player avatars (supporting uploaded file base64 or retro preset)
  const renderAvatar = (player: PlayerHistory, sizeClass = "w-10 h-10 text-xs") => {
    if (player.avatar && player.avatar.startsWith("data:image/")) {
      return (
        <img
          src={player.avatar}
          alt={player.displayName}
          referrerPolicy="no-referrer"
          className={`${sizeClass} rounded-full object-cover border border-slate-700 shadow-lg`}
        />
      );
    }

    const preset = PRESET_AVATARS.find((p) => p.id === player.avatar);
    if (preset) {
      const initials = player.displayName.slice(0, 2).toUpperCase();
      const emoji = preset.label.split(" ")[0];
      return (
        <div
          className={`${sizeClass} rounded-full bg-gradient-to-br ${preset.color} border border-white/10 flex items-center justify-center font-black text-white shadow-lg relative`}
        >
          <span className="text-[10px] absolute -bottom-1 -right-1 bg-[#0c0f17] px-1 rounded-full border border-slate-800">
            {emoji}
          </span>
          {initials}
        </div>
      );
    }

    // Default initials avatar
    const initials = player.displayName.slice(0, 2).toUpperCase();
    return (
      <div
        className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-600 to-purple-600 border border-white/10 flex items-center justify-center font-bold text-white shadow-lg`}
      >
        {initials}
      </div>
    );
  };

  // Compile leaderboard stats for the selected game
  const rankedPlayers = players
    .map((player) => {
      const gameStats = player.games[activeGameId] || {
        matchesCount: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        totalScore: 0,
        averageRating: 0,
      };

      const avgKills = gameStats.matchesCount > 0 ? gameStats.totalKills / gameStats.matchesCount : 0;
      const avgDeaths = gameStats.matchesCount > 0 ? gameStats.totalDeaths / gameStats.matchesCount : 0;
      const avgAssists = gameStats.matchesCount > 0 ? gameStats.totalAssists / gameStats.matchesCount : 0;
      const avgScore = gameStats.matchesCount > 0 ? gameStats.totalScore / gameStats.matchesCount : 0;

      return {
        player,
        matchesCount: gameStats.matchesCount,
        averageRating: gameStats.averageRating || 0,
        avgKills,
        avgDeaths,
        avgAssists,
        avgScore,
        ratioKDA: avgDeaths > 0 ? (avgKills + avgAssists) / avgDeaths : avgKills + avgAssists,
      };
    })
    .filter((rp) => rp.player.displayName.toLowerCase().includes(searchQuery.toLowerCase()));

  // Sort based on selection
  const sortedPlayers = [...rankedPlayers].sort((a, b) => {
    if (sortBy === "rating") {
      return b.averageRating - a.averageRating || b.matchesCount - a.matchesCount;
    } else if (sortBy === "matches") {
      return b.matchesCount - a.matchesCount || b.averageRating - a.averageRating;
    } else if (sortBy === "kills") {
      return b.avgKills - a.avgKills || b.averageRating - a.averageRating;
    } else {
      return b.avgScore - a.avgScore || b.averageRating - a.averageRating;
    }
  });

  // Separate active/ranked and unranked players (0 matches)
  const activeLeaderboard = sortedPlayers.filter((p) => p.matchesCount > 0);
  const unrankedPlayers = sortedPlayers.filter((p) => p.matchesCount === 0);

  // Top 3 pedestal players
  const top1 = activeLeaderboard[0];
  const top2 = activeLeaderboard[1];
  const top3 = activeLeaderboard[2];

  return (
    <div className="space-y-6">
      {/* Header and Game Selector */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-[#121824] border border-[#1e293b] rounded-xl p-5 shadow-2xl">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="text-amber-400 w-5.5 h-5.5 animate-pulse" /> 🏆 Hall of Legends
          </h2>
          <p className="text-xs text-gray-400">
            Leaderboard rankings computed using custom formulas for <span className="text-emerald-400 font-extrabold">{activeGame?.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search legends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-[#0c0f17] border border-slate-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 w-full sm:w-48"
            />
          </div>

          <select
            value={activeGameId}
            onChange={(e) => onSetActiveGame(e.target.value)}
            className="bg-[#0c0f17] border border-slate-800 text-xs font-semibold rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {/* Sort Controls */}
          <div className="flex bg-[#0c0f17] p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setSortBy("rating")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
                sortBy === "rating" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Rating
            </button>
            <button
              onClick={() => setSortBy("matches")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
                sortBy === "matches" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Matches
            </button>
            <button
              onClick={() => setSortBy("kills")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
                sortBy === "kills" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Kills
            </button>
            <button
              onClick={() => setSortBy("score")}
              className={`px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
                sortBy === "score" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Combat Score
            </button>
          </div>
        </div>
      </div>

      {/* Top 3 Podium (Only render if there are ranked players) */}
      {activeLeaderboard.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-8 pb-4 max-w-4xl mx-auto">
          {/* 2nd Place Podium */}
          {top2 ? (
            <div className="bg-gradient-to-t from-[#111723] to-[#121a2c] border-x border-t border-[#1e293b] rounded-t-2xl p-5 text-center flex flex-col items-center order-2 md:order-1 h-72 justify-between shadow-2xl relative">
              <div className="absolute -top-6 bg-slate-800 border-2 border-slate-400 text-slate-200 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                2
              </div>
              <div className="mt-4 flex flex-col items-center space-y-2">
                <div className="relative p-1 rounded-full bg-slate-500/20 border border-slate-400/40">
                  {renderAvatar(top2.player, "w-16 h-16 text-md")}
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-md tracking-tight leading-none">
                    {top2.player.displayName}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {top2.matchesCount} matches played
                  </span>
                </div>
              </div>

              <div className="w-full bg-[#0c0f17]/60 rounded-xl p-3 border border-slate-900 flex flex-col items-center">
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-wider block">
                  Performance Rating
                </span>
                <span className="text-xl font-mono font-black text-slate-300">
                  {top2.averageRating.toFixed(1)}
                </span>
              </div>
            </div>
          ) : (
            <div className="hidden md:block order-1 h-1"></div>
          )}

          {/* 1st Place Podium */}
          {top1 && (
            <div className="bg-gradient-to-t from-[#111723] via-[#1a253c] to-[#203154] border border-amber-500/30 rounded-t-2xl p-6 text-center flex flex-col items-center order-1 md:order-2 h-80 justify-between shadow-2xl shadow-amber-500/5 relative">
              <div className="absolute -top-7 bg-amber-500 border-2 border-yellow-300 text-black w-14 h-14 rounded-full flex items-center justify-center font-black text-xl shadow-xl shadow-amber-500/10">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="mt-4 flex flex-col items-center space-y-2">
                <div className="relative p-1 rounded-full bg-amber-500/20 border-2 border-amber-400 animate-pulse">
                  {renderAvatar(top1.player, "w-20 h-20 text-lg")}
                  <span className="absolute -top-2 -right-2 bg-amber-500 text-black font-extrabold text-[9px] px-1.5 py-0.5 rounded-full border border-[#1a253c]">
                    MVP
                  </span>
                </div>
                <div>
                  <h3 className="font-black text-white text-lg tracking-wider leading-none flex items-center gap-1.5 justify-center">
                    {top1.player.displayName} <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                  </h3>
                  <span className="text-[10px] text-amber-400/80 font-mono font-bold uppercase tracking-wider block mt-1">
                    {top1.matchesCount} matches logged
                  </span>
                </div>
              </div>

              <div className="w-full bg-[#0c0f17]/85 rounded-xl p-3.5 border border-amber-500/20 flex flex-col items-center shadow-lg shadow-amber-500/5">
                <span className="text-[10px] text-amber-400/80 uppercase font-black tracking-wider block">
                  Champion Rating
                </span>
                <span className="text-2xl font-mono font-black text-amber-400">
                  {top1.averageRating.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          {/* 3rd Place Podium */}
          {top3 ? (
            <div className="bg-gradient-to-t from-[#111723] to-[#121a2c] border-x border-t border-[#1e293b] rounded-t-2xl p-5 text-center flex flex-col items-center order-3 md:order-3 h-64 justify-between shadow-2xl relative">
              <div className="absolute -top-6 bg-amber-850 border-2 border-amber-700 text-amber-300 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                3
              </div>
              <div className="mt-4 flex flex-col items-center space-y-2">
                <div className="relative p-1 rounded-full bg-amber-750/20 border border-amber-700/40">
                  {renderAvatar(top3.player, "w-16 h-16 text-md")}
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-md tracking-tight leading-none">
                    {top3.player.displayName}
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {top3.matchesCount} matches played
                  </span>
                </div>
              </div>

              <div className="w-full bg-[#0c0f17]/60 rounded-xl p-3 border border-slate-900 flex flex-col items-center">
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-wider block">
                  Performance Rating
                </span>
                <span className="text-xl font-mono font-black text-amber-600">
                  {top3.averageRating.toFixed(1)}
                </span>
              </div>
            </div>
          ) : (
            <div className="hidden md:block order-3 h-1"></div>
          )}
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="bg-[#121824] border border-[#1e293b] rounded-xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-900 flex justify-between items-center bg-[#0e1320]/30">
          <h3 className="text-sm font-black text-white tracking-widest uppercase">
            Leaderboard Standings
          </h3>
          <span className="text-xs text-gray-400 font-mono">
            {activeLeaderboard.length} Ranked Legends
          </span>
        </div>

        {activeLeaderboard.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Trophy className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-white font-bold">No Ranked Players Found</p>
            <p className="text-gray-500 text-xs mt-1 max-w-sm mx-auto">
              Players who have matches logged in {activeGame?.name} will appear here with calculated ratings.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[#0c0f17]/40 text-gray-400 text-xs uppercase tracking-wider font-bold border-b border-slate-900">
                  <th className="py-3 px-6 text-center w-16">Rank</th>
                  <th className="py-3 px-4">Legend</th>
                  <th className="py-3 px-4 text-center">Matches</th>
                  <th className="py-3 px-4 text-right">Avg K/D/A</th>
                  <th className="py-3 px-4 text-right">Avg Combat Score</th>
                  <th className="py-3 px-6 text-right">Active Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {activeLeaderboard.map((rp, index) => {
                  const rank = index + 1;
                  const isTop3 = rank <= 3;

                  return (
                    <tr
                      key={rp.player.name}
                      className={`hover:bg-slate-900/20 transition-colors ${
                        isTop3 ? "bg-amber-500/[0.01]" : ""
                      }`}
                    >
                      {/* Rank Column */}
                      <td className="py-3.5 px-6 text-center">
                        <div className="flex justify-center items-center">
                          {rank === 1 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center font-black text-xs shadow shadow-amber-500/20">
                              1
                            </span>
                          ) : rank === 2 ? (
                            <span className="w-6 h-6 rounded-full bg-slate-400 text-black flex items-center justify-center font-black text-xs shadow shadow-slate-500/20">
                              2
                            </span>
                          ) : rank === 3 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center font-black text-xs shadow shadow-amber-800/20">
                              3
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-gray-500 font-bold">
                              #{rank}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Legend Name and Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {renderAvatar(rp.player, "w-9 h-9 text-[10px]")}
                          <div>
                            <span className="font-extrabold text-white text-sm block">
                              {rp.player.displayName}
                            </span>
                            <span className="text-[10px] text-gray-500 block font-mono">
                              ID: {rp.player.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Matches Count */}
                      <td className="py-3.5 px-4 text-center font-mono text-gray-300">
                        {rp.matchesCount}
                      </td>

                      {/* Avg K/D/A */}
                      <td className="py-3.5 px-4 text-right font-mono text-gray-400 text-xs">
                        <span className="text-gray-200">{rp.avgKills.toFixed(1)}</span> /{" "}
                        <span className="text-gray-200">{rp.avgDeaths.toFixed(1)}</span> /{" "}
                        <span className="text-gray-200">{rp.avgAssists.toFixed(1)}</span>
                      </td>

                      {/* Average Score */}
                      <td className="py-3.5 px-4 text-right font-mono text-gray-300">
                        {Math.round(rp.avgScore)}
                      </td>

                      {/* Active Rating */}
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1 font-mono">
                          {isTop3 && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                          <span
                            className={`font-black text-sm ${
                              rank === 1
                                ? "text-amber-400 text-md"
                                : rank === 2
                                ? "text-slate-300"
                                : rank === 3
                                ? "text-amber-600"
                                : "text-emerald-400"
                            }`}
                          >
                            {rp.averageRating.toFixed(1)}
                          </span>
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

      {/* Unranked Legends (Registered players who haven't logged any matches yet) */}
      {unrankedPlayers.length > 0 && (
        <div className="bg-[#121824] border border-[#1e293b] rounded-xl shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h3 className="text-xs font-black text-gray-400 tracking-widest uppercase flex items-center gap-2">
              <Award className="w-4 h-4 text-gray-500" /> Unranked Recruits
            </h3>
            <span className="text-xs font-mono text-gray-500">
              {unrankedPlayers.length} awaiting placement
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {unrankedPlayers.map((rp) => (
              <div
                key={rp.player.name}
                className="bg-[#0c0f17]/50 border border-slate-900 rounded-xl p-3.5 flex items-center gap-3 hover:border-slate-800 transition-colors"
              >
                {renderAvatar(rp.player, "w-10 h-10 text-xs")}
                <div>
                  <span className="font-extrabold text-gray-200 text-xs block leading-none mb-1">
                    {rp.player.displayName}
                  </span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono font-bold block">
                    No Matches Yet
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
