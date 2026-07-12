import React, { useEffect, useState } from "react";
import { api, formatError, API_BASE } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Star, FileDown } from "lucide-react";

export default function Reports() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ week_start: "", week_end: "", total_duties_assigned: 0, total_duties_attended: 0, challenges: "", suggestions: "", self_evaluation: 3, remarks: "" });

  const missed = Math.max(0, (Number(form.total_duties_assigned) || 0) - (Number(form.total_duties_attended) || 0));

  const load = async () => { const { data } = await api.get("/reports"); setList(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      const body = { ...form, total_duties_assigned: Number(form.total_duties_assigned), total_duties_attended: Number(form.total_duties_attended), self_evaluation: Number(form.self_evaluation) };
      await api.post("/reports", body);
      toast.success("Report submitted");
      setOpen(false); load();
      setForm({ week_start: "", week_end: "", total_duties_assigned: 0, total_duties_attended: 0, challenges: "", suggestions: "", self_evaluation: 3, remarks: "" });
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const downloadPdf = async (id) => {
    try {
      const res = await api.get(`/reports/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch { toast.error("Failed to download PDF"); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="reports-title">Weekly Reports</h1>
          <p className="text-slate-400 text-sm mt-1">Submit and review weekly leadership reports.</p>
        </div>
        {user?.role === "leader" && (
          <Button onClick={() => setOpen(true)} className="btn-primary" data-testid="new-report-button"><Plus className="w-4 h-4 mr-1" /> New Report</Button>
        )}
      </div>

      <div className="grid gap-4">
        {list.map(r => (
          <div key={r.id} className="card-surface p-5" data-testid={`report-${r.id}`}>
            <div className="flex justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold">{r.leader_name} <span className="text-xs font-mono text-sky-400 ml-2">{r.leader_id}</span></div>
                <div className="text-xs text-slate-500">Week {r.week_start} → {r.week_end}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">{[1,2,3,4,5].map(n => <Star key={n} className={`w-4 h-4 ${n <= r.self_evaluation ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />)}</div>
                <Button size="sm" variant="outline" onClick={() => downloadPdf(r.id)} data-testid={`pdf-${r.id}`}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div className="text-center p-3 rounded bg-[#060F1E] border border-white/5">
                <div className="text-2xl font-bold text-sky-400" style={{ fontFamily: "Space Grotesk" }}>{r.total_duties_assigned}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest">Assigned</div>
              </div>
              <div className="text-center p-3 rounded bg-[#060F1E] border border-white/5">
                <div className="text-2xl font-bold text-emerald-400" style={{ fontFamily: "Space Grotesk" }}>{r.total_duties_attended}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest">Attended</div>
              </div>
              <div className="text-center p-3 rounded bg-[#060F1E] border border-white/5">
                <div className="text-2xl font-bold text-red-400" style={{ fontFamily: "Space Grotesk" }}>{r.total_duties_missed}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest">Missed</div>
              </div>
            </div>
            {r.challenges && <div className="mt-3 text-sm"><span className="text-slate-500 uppercase tracking-widest text-xs">Challenges: </span>{r.challenges}</div>}
            {r.suggestions && <div className="mt-1 text-sm"><span className="text-slate-500 uppercase tracking-widest text-xs">Suggestions: </span>{r.suggestions}</div>}
          </div>
        ))}
        {list.length === 0 && <div className="card-surface p-8 text-center text-slate-500">No reports yet.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="card-surface max-w-lg">
          <DialogHeader><DialogTitle>New Weekly Report</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Week Start</Label><Input data-testid="week-start" type="date" value={form.week_start} onChange={e => setForm({ ...form, week_start: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Week End</Label><Input data-testid="week-end" type="date" value={form.week_end} onChange={e => setForm({ ...form, week_end: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Duties Assigned</Label><Input data-testid="duties-assigned" type="number" min="0" value={form.total_duties_assigned} onChange={e => setForm({ ...form, total_duties_assigned: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Duties Attended</Label><Input data-testid="duties-attended" type="number" min="0" value={form.total_duties_attended} onChange={e => setForm({ ...form, total_duties_attended: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2 text-sm text-slate-400">Missed: <span className="text-red-400 font-bold">{missed}</span></div>
            <div className="col-span-2"><Label>Challenges</Label><Textarea value={form.challenges} onChange={e => setForm({ ...form, challenges: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2"><Label>Suggestions</Label><Textarea value={form.suggestions} onChange={e => setForm({ ...form, suggestions: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2">
              <Label>Self Evaluation</Label>
              <div className="flex gap-2 mt-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, self_evaluation: n })} data-testid={`rate-${n}`} className="p-1">
                    <Star className={`w-7 h-7 ${n <= form.self_evaluation ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
                  </button>
                ))}
                <span className="ml-2 text-sm text-slate-400">{form.self_evaluation}/5</span>
              </div>
            </div>
            <div className="col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="btn-primary" onClick={submit} data-testid="submit-report-button">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
