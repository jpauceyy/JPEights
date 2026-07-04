import React, { useState, useEffect } from "react";
import { ShieldCheck, Lock, User, RefreshCw, AlertTriangle, Crosshair, ArrowRight, CheckCircle2 } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess: (token: string, username: string) => void;
  initialHasUsers: boolean;
}

export default function AuthScreen({ onAuthSuccess, initialHasUsers }: AuthScreenProps) {
  const [isRegister, setIsRegister] = useState(!initialHasUsers);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    if (isRegister) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = {
        username,
        password,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      // Store in localStorage
      localStorage.setItem("cod_balancer_token", data.token);
      localStorage.setItem("cod_balancer_username", data.username);

      // Trigger success callback
      onAuthSuccess(data.token, data.username);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.08),rgba(0,0,0,0))] flex items-center justify-center p-4">
      {/* Background Matrix/Grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none opacity-20" />

      <div className="relative w-full max-w-md bg-[#0b0e14] border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden p-6 md:p-8 space-y-6">
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500/60 rounded-tl" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500/60 rounded-tr" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500/60 rounded-bl" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500/60 rounded-br" />

        {/* Tactical Title HUD */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2">
            <Crosshair className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-wider uppercase font-sans">
            Tactical Link Terminal
          </h1>
          <p className="text-xs text-gray-400 font-mono">
            {!initialHasUsers 
              ? "SETUP ADMINISTRATOR CREDENTIALS" 
              : isRegister 
                ? "REGISTER NEW SQUAD OPERATOR" 
                : "SECURE SQUAD AUTHENTICATION"}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl flex items-start gap-3 text-xs animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold uppercase tracking-wider block">Security Alert</span>
              <p className="leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">
              Operator Username
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Price_141"
                className="w-full bg-[#121620] border border-slate-800 focus:border-emerald-500/50 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-600 text-sm font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">
              Security Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#121620] border border-slate-800 focus:border-emerald-500/50 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-600 text-sm font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Confirm Password (Register Only) */}
          {isRegister && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required={isRegister}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#121620] border border-slate-800 focus:border-emerald-500/50 rounded-xl pl-11 pr-4 py-2.5 text-white placeholder-slate-600 text-sm font-mono focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative group mt-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all font-mono text-sm uppercase tracking-wider flex items-center justify-center gap-2 overflow-hidden shadow-lg shadow-emerald-950/20"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Establishing Feed...
              </>
            ) : (
              <>
                {isRegister ? "Submit Registration Link" : "Establish Tactical Feed"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode Footer */}
        {initialHasUsers && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors"
            >
              {isRegister ? "ALREADY AN OPERATOR? SIGN IN" : "CREATE NEW OPERATOR PROFILE"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
