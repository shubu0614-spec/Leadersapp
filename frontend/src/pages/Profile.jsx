import React, { useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { KeyRound, Award, TrendingUp, TrendingDown, CalendarOff, ClipboardCheck, FileText } from "lucide-react";

export default function Profile() {
  const [p, setP] = useState(null);
  const [open, setOpen] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");

  const load = async () => { const { data } = await api.get("/profile/me"); setP(data); };
  useEffect(() => { load(); }, []);

  const changePin = async () => {
    if (!/^\d{4}$/.test(newPin)) return toast.error("PIN must be 4 digits");
    try { await api.post("/auth/change-pin", { old_pin: oldPin, new_pin: newPin }); toast.success("PIN changed"); setOpen(false); setOldPin(""); setNewPin(""); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  if (!p) return <div className="text-slate-400">Loading...</div>;
  const u = p.user;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="profile-title">My Profile</h1><p className="text-slate-400 text-sm mt-1">Your personal information and stats.</p></div>
        <Button onClick={() => setOpen(true)} className="btn-primary" data-testid="change-pin-button"><KeyRound className="w-4 h-4 mr-1" /> Change PIN</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card-surface p-6 lg:col-span-2">
          <div className="flex items-start gap-6 flex-wrap">
            <div className="w-24 h-24 rounded-lg flex items-center justify-center text-3xl font-bold text-white" style={{ background: "linear-gradient(135deg, #1E3A8A, #1D4ED8)", fontFamily: "Space Grotesk" }}>
              {u.name?.split(" ").map(x => x[0]).slice(0, 2).join("")}
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold" style={{ fontFamily: "Space Grotesk" }}>{u.name}</div>
              <div className="text-sky-400 font-mono text-sm">{u.leader_id}</div>
              <div className="text-slate-400 text-sm mt-1">{u.position || "-"} · {u.department || "-"}</div>
              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div><span className="text-slate-500">Role:</span> <span className="text-white capitalize">{u.role.replace("_", " ")}</span></div>
                <div><span className="text-slate-500">Class:</span> <span className="text-white">{u.class_name || "-"}</span></div>
                <div><span className="text-slate-500">Section:</span> <span className="text-white">{u.section || "-"}</span></div>
                <div><span className="text-slate-500">Status:</span> <span className="text-emerald-400 capitalize">{u.status}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="card-surface p-6 flex flex-col items-center">
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Your QR Code</div>
          <div className="bg-white p-3 rounded"><QRCodeSVG value={u.qr_token || u.leader_id} size={140} /></div>
          <div className="text-xs text-slate-500 mt-3">Only Super Admin can regenerate.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 stagger">
        <div className="card-surface p-4"><Award className="w-4 h-4 text-amber-400" /><div className="text-2xl font-bold mt-2" style={{ fontFamily: "Space Grotesk" }}>{p.points}</div><div className="text-xs text-slate-500 uppercase">Total Points</div></div>
        <div className="card-surface p-4"><TrendingUp className="w-4 h-4 text-emerald-400" /><div className="text-2xl font-bold text-emerald-400 mt-2" style={{ fontFamily: "Space Grotesk" }}>+{p.rewards_total}</div><div className="text-xs text-slate-500 uppercase">Rewards</div></div>
        <div className="card-surface p-4"><TrendingDown className="w-4 h-4 text-red-400" /><div className="text-2xl font-bold text-red-400 mt-2" style={{ fontFamily: "Space Grotesk" }}>{p.penalties_total}</div><div className="text-xs text-slate-500 uppercase">Penalties</div></div>
        <div className="card-surface p-4"><CalendarOff className="w-4 h-4 text-sky-400" /><div className="text-2xl font-bold mt-2" style={{ fontFamily: "Space Grotesk" }}>{p.leave_balance}</div><div className="text-xs text-slate-500 uppercase">Leave Balance</div></div>
        <div className="card-surface p-4"><FileText className="w-4 h-4 text-purple-400" /><div className="text-2xl font-bold mt-2" style={{ fontFamily: "Space Grotesk" }}>{p.reports_submitted}</div><div className="text-xs text-slate-500 uppercase">Reports</div></div>
      </div>

      <div className="card-surface p-6">
        <div className="flex items-center gap-2 mb-4"><ClipboardCheck className="w-4 h-4 text-sky-400" /><h3 className="text-sm uppercase tracking-widest text-slate-300">Attendance Summary</h3></div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div><div className="text-2xl font-bold" style={{ fontFamily: "Space Grotesk" }}>{p.attendance.total}</div><div className="text-xs text-slate-500 uppercase">Total</div></div>
          <div><div className="text-2xl font-bold text-emerald-400" style={{ fontFamily: "Space Grotesk" }}>{p.attendance.present}</div><div className="text-xs text-slate-500 uppercase">Present</div></div>
          <div><div className="text-2xl font-bold text-amber-400" style={{ fontFamily: "Space Grotesk" }}>{p.attendance.late}</div><div className="text-xs text-slate-500 uppercase">Late</div></div>
          <div><div className="text-2xl font-bold text-red-400" style={{ fontFamily: "Space Grotesk" }}>{p.attendance.absent}</div><div className="text-xs text-slate-500 uppercase">Absent</div></div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="card-surface">
          <DialogHeader><DialogTitle>Change PIN</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Current PIN</Label><Input type="password" maxLength={4} value={oldPin} onChange={e => setOldPin(e.target.value.replace(/\D/g, ""))} className="bg-[#060F1E] border-white/10" data-testid="old-pin" /></div>
            <div><Label>New PIN</Label><Input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} className="bg-[#060F1E] border-white/10" data-testid="new-pin" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="btn-primary" onClick={changePin} data-testid="confirm-change-pin">Change</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
