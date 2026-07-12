import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Trophy, Medal, Award, Crown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Rankings() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/rankings"); setData(data); } catch {}
    })();
  }, []);

  if (!data) return <div className="text-slate-400">Loading...</div>;

  const isLeader = user?.role === "leader";
  const banner = data.is_rank1
    ? "Congratulations! You are currently Rank #1."
    : data.my_rank
      ? `You need ${data.points_to_rank1} more points to reach Rank #1.`
      : null;

  const rankIcon = (r) => {
    if (r === 1) return <Crown className="w-5 h-5 text-amber-300" />;
    if (r === 2) return <Medal className="w-5 h-5 text-slate-300" />;
    if (r === 3) return <Award className="w-5 h-5 text-orange-400" />;
    return <span className="w-5 h-5 inline-flex items-center justify-center text-slate-500 text-xs font-mono">#{r}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="rankings-title">Leader Rankings</h1>
        <p className="text-slate-400 text-sm mt-1">Sorted by total points, updated in real time.</p>
      </div>

      {banner && isLeader && (
        <div className="card-surface p-5 border-l-4 border-sky-400 flex items-center gap-3" data-testid="rank-banner">
          <Trophy className="w-6 h-6 text-sky-400" />
          <div>
            <div className="text-lg font-semibold" style={{ fontFamily: "Space Grotesk" }}>{banner}</div>
            <div className="text-xs text-slate-500 mt-1">Current rank: #{data.my_rank ?? "-"} · {data.my_points} pts</div>
          </div>
        </div>
      )}

      <div className="card-surface p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-white/10">
              <th className="py-3 px-2 w-16">Rank</th>
              <th className="py-3 px-2">Leader</th>
              <th className="py-3 px-2">Position</th>
              <th className="py-3 px-2">Department</th>
              <th className="py-3 px-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {data.rankings.map(r => {
              const me = r.leader_id === user?.leader_id;
              return (
                <tr key={r.leader_id} className={`border-b border-white/5 ${me ? "bg-sky-500/10" : ""}`} data-testid={`rank-row-${r.leader_id}`}>
                  <td className="py-3 px-2"><div className="flex items-center gap-2">{rankIcon(r.rank)}</div></td>
                  <td className="py-3 px-2 font-medium">{r.name} {me && <span className="text-xs text-sky-400 ml-2">You</span>}<div className="text-xs font-mono text-sky-400">{r.leader_id}</div></td>
                  <td className="py-3 px-2 text-slate-400">{r.position || "-"}</td>
                  <td className="py-3 px-2 text-slate-400">{r.department || "-"}</td>
                  <td className="py-3 px-2 text-right font-bold text-amber-300" style={{ fontFamily: "Space Grotesk" }}>{r.points}</td>
                </tr>
              );
            })}
            {data.rankings.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">No leaders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
