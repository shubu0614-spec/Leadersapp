import React, { useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";

export default function Rewards() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leader_id: "", points: 0, reason: "" });
  const isAdmin = user?.role === "super_admin";

  const load = async () => {
    const { data } = await api.get("/rewards");
    setList(data);
    if (isAdmin) {
      const { data: l } = await api.get("/leaders", { params: { role: "leader" } });
      setLeaders(l);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      const body = { ...form, points: Number(form.points) };
      if (!body.leader_id) return toast.error("Select a leader");
      if (body.points === 0) return toast.error("Enter a non-zero value");
      await api.post("/rewards", body);
      toast.success(body.points > 0 ? "Reward given" : "Penalty issued");
      setOpen(false); setForm({ leader_id: "", points: 0, reason: "" }); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="rewards-title">Rewards & Penalties</h1><p className="text-slate-400 text-sm mt-1">Positive values create rewards, negative values create penalties.</p></div>
        {isAdmin && <Button onClick={() => setOpen(true)} className="btn-primary" data-testid="add-reward-button"><Plus className="w-4 h-4 mr-1" /> Give Points</Button>}
      </div>
      <div className="card-surface p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-white/10">
              <th className="py-3 px-2">Leader</th><th className="py-3 px-2">Type</th><th className="py-3 px-2">Points</th><th className="py-3 px-2">Reason</th><th className="py-3 px-2">Given By</th><th className="py-3 px-2">When</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id} className="border-b border-white/5" data-testid={`reward-${r.id}`}>
                <td className="py-3 px-2"><div className="font-medium">{r.leader_name}</div><div className="text-xs font-mono text-sky-400">{r.leader_id}</div></td>
                <td className="py-3 px-2">
                  {r.points > 0 ? <span className="text-emerald-400 inline-flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Reward</span> : <span className="text-red-400 inline-flex items-center gap-1"><TrendingDown className="w-4 h-4" /> Penalty</span>}
                </td>
                <td className={`py-3 px-2 font-bold ${r.points > 0 ? "text-emerald-400" : "text-red-400"}`}>{r.points > 0 ? "+" : ""}{r.points}</td>
                <td className="py-3 px-2 text-slate-400">{r.reason}</td>
                <td className="py-3 px-2 text-slate-400 text-xs">{r.given_by_name}</td>
                <td className="py-3 px-2 text-xs text-slate-500">{r.date} {r.time}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No history.</td></tr>}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="card-surface">
          <DialogHeader><DialogTitle>Reward or Penalty</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Leader</Label>
              <Select value={form.leader_id} onValueChange={v => setForm({ ...form, leader_id: v })}>
                <SelectTrigger data-testid="reward-leader" className="bg-[#060F1E] border-white/10"><SelectValue placeholder="Select leader" /></SelectTrigger>
                <SelectContent>{leaders.map(l => <SelectItem key={l.leader_id} value={l.leader_id}>{l.name} ({l.leader_id})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Points (+ reward, − penalty)</Label><Input data-testid="reward-points" type="number" value={form.points} onChange={e => setForm({ ...form, points: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Reason</Label><Input data-testid="reward-reason" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="btn-primary" onClick={submit} data-testid="save-reward-button">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
