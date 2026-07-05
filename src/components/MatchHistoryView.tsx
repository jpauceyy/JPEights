import React, { useState } from "react";
import { FileText, Calendar, Trash2, Award, ArrowRight, Trophy, Zap, AlertCircle } from "lucide-react";
import { MatchRecord } from "../types";
import { apiFetch } from "../lib/api";

interface MatchHistoryViewProps {
  matches: MatchRecord[];
  onRefresh: () => void;
  isAdmin?: boolean;
}

export default function MatchHistoryView({ matches, onRefresh, isAdmin = false }: MatchHistoryViewProps) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedMatchId(expandedMatchId === id ? null : id);
  };

  const handleDeleteMatch = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this match record? This will subtract all K/D/A scores from the players' databases and rollback their ratings.")) return;

    try {
      const res = await apiFetch(`/api/matches/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete match record.");
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete match");
    }
  };

  if (matches.length === 0) {
    return (
      <div className="bg-[#121824] border border-[#1e293b] rounded-xl p-8 text-center shadow-2xl">
        <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
        <h3 className="font-bold text-white text-lg">No Match History</h3>
        <p className="text-gray-500 text-sm mt-1 max-w-sm mx-auto">
          You haven't logged any matches yet. Balancer results logged using the "Log Match History" option will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="text-amber-400 w-5 h-5" /> Match History Log
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Browse through previously generated balances and rollback scores to undo statistics.
          </p>
        </div>
        <span className="text-xs font-mono font-bold bg-[#0c0f17] border border-slate-900 text-gray-400 px-2.5 py-1 rounded-full">
          {matches.length} Total Logs
        </span>
      </div>

      <div className="space-y-4">
        {matches.map((match) => {
          const isExpanded = expandedMatchId === match.id;
          const formattedDate = new Date(match.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={match.id}
              className="bg-[#121824] border border-[#1e293b] hover:border-slate-800 rounded-xl overflow-hidden shadow-xl transition-all"
            >
              {/* Card Header Row */}
              <div
                onClick={() => toggleExpand(match.id)}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/10 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-[#0c0f17] border border-slate-900 rounded-lg text-amber-400 shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-white tracking-tight">{match.gameName} Match</h3>
                      <span className="text-[10px] font-bold font-mono bg-blue-950/50 border border-blue-900/30 text-blue-400 px-2 py-0.5 rounded">
                        {match.players.length} Players
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> {formattedDate}
                    </p>
                  </div>
                </div>

                {match.teams ? (
                  <div className="flex flex-wrap items-center gap-4 md:gap-8">
                    {/* Compact Teams Rating */}
                    <div className="flex items-center gap-2 text-xs font-mono font-bold bg-[#0c0f17] p-2.5 rounded-lg border border-slate-900">
                      <span className="text-blue-400">A: {match.teams.teamA.totalRating}</span>
                      <span className="text-gray-600">|</span>
                      <span className="text-purple-400">B: {match.teams.teamB.totalRating}</span>
                      <span className="text-gray-600">|</span>
                      <span className="text-amber-400">Diff: {match.teams.difference}</span>
                    </div>

                    {/* Game Score (Hardpoint/Snd) */}
                    {match.teamAScore !== undefined && match.teamBScore !== undefined && (
                      <div className="flex items-center gap-2 text-xs font-mono font-bold bg-slate-950/40 px-3 py-2.5 rounded-lg border border-slate-900">
                        {match.gameMode && <span className="text-gray-400/80 mr-1">[{match.gameMode}]</span>}
                        <span className={match.teamAScore > match.teamBScore ? "text-emerald-400 font-extrabold" : "text-blue-400"}>
                          Alpha: {match.teamAScore}
                        </span>
                        <span className="text-gray-600 font-normal">vs</span>
                        <span className={match.teamBScore > match.teamAScore ? "text-emerald-400 font-extrabold" : "text-purple-400"}>
                          Omega: {match.teamBScore}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(match.id);
                        }}
                        className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
                      >
                        {isExpanded ? "Hide Details" : "View Details"}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMatch(match.id);
                          }}
                          className="p-2 text-gray-500 hover:text-red-400 rounded-lg bg-slate-900/50 hover:bg-red-950/20 border border-slate-800 hover:border-red-900/30 transition-all"
                          title="Delete Match History and Rollback Stats"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs italic text-gray-500">Unbalanced stats upload</span>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMatch(match.id);
                        }}
                        className="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-slate-900 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Collapsible Details Body */}
              {isExpanded && match.teams && (
                <div className="border-t border-slate-900 p-6 bg-[#0c0f17]/40 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Team Alpha details */}
                  <div className="bg-[#0c0f17]/80 border border-slate-900 rounded-xl p-4 space-y-3 shadow-inner">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                      <span className="text-xs font-extrabold text-blue-400 tracking-wider">TEAM ALPHA</span>
                      <span className="text-xs font-mono font-bold text-blue-400">Rating: {match.teams.teamA.totalRating}</span>
                    </div>
                    <div className="space-y-2">
                      {match.teams.teamA.players.map((p) => (
                        <div key={p.name} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-900/30 last:border-b-0">
                          <span className="font-bold text-gray-200">{p.name}</span>
                          <div className="flex items-center gap-4 text-gray-400 font-mono">
                            <span>K/D/A: {p.kills}/{p.deaths}/{p.assists}</span>
                            <span className="font-bold text-emerald-400">{p.rating}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team Omega details */}
                  <div className="bg-[#0c0f17]/80 border border-slate-900 rounded-xl p-4 space-y-3 shadow-inner">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                      <span className="text-xs font-extrabold text-purple-400 tracking-wider">TEAM OMEGA</span>
                      <span className="text-xs font-mono font-bold text-purple-400">Rating: {match.teams.teamB.totalRating}</span>
                    </div>
                    <div className="space-y-2">
                      {match.teams.teamB.players.map((p) => (
                        <div key={p.name} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-900/30 last:border-b-0">
                          <span className="font-bold text-gray-200">{p.name}</span>
                          <div className="flex items-center gap-4 text-gray-400 font-mono">
                            <span>K/D/A: {p.kills}/{p.deaths}/{p.assists}</span>
                            <span className="font-bold text-emerald-400">{p.rating}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
