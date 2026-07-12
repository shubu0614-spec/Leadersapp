import React, { useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Eye, Check } from "lucide-react";

const P_COLORS = { normal: "border-sky-400/40 bg-sky-500/10 text-sky-300", important: "border-amber-400/40 bg-amber-500/10 text-amber-300", urgent: "border-red-400/40 bg-red-500/10 text-red-300" };
const empty = { title: "", message: "", priority: "normal", publish_date: "", expiry_date: "" };

export default function Announcements() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [statusOpen, setStatusOpen] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const isAdmin = user?.role === "super_admin";

  const load = async () => { const { data } = await api.get("/announcements"); setList(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api.put(`/announcements/${editing.id}`, form);
      else await api.post("/announcements", form);
      toast.success("Saved"); setOpen(false); setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const del = async (id) => { try { await api.delete(`/announcements/${id}`); toast.success("Deleted"); load(); } catch (e) { toast.error(formatError(e.response?.data?.detail)); } };
  const markRead = async (id) => { try { await api.post(`/announcements/${id}/read`); toast.success("Marked as read"); load(); } catch (e) { toast.error(formatError(e.response?.data?.detail)); } };
  const showStatus = async (a) => { try { const { data } = await api.get(`/announcements/${a.id}/read-status`); setStatusData(data); setStatusOpen(a); } catch (e) { toast.error(formatError(e.response?.data?.detail)); } };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="announcements-title">Announcement Board</h1><p className="text-slate-400 text-sm mt-1">Broadcast important updates to leaders.</p></div>
        {isAdmin && <Button onClick={() => { setForm(empty); setEditing(null); setOpen(true); }} className="btn-primary" data-testid="add-announcement-button"><Plus className="w-4 h-4 mr-1" /> New</Button>}
      </div>
      <div className="grid gap-4 stagger">
        {list.map(a => (
          <div key={a.id} className={`card-surface p-5 border-l-4 ${P_COLORS[a.priority]}`} data-testid={`announcement-${a.id}`}>
            <div className="flex justify-between flex-wrap gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2"><h3 className="font-semibold">{a.title}</h3><span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/5">{a.priority}</span>{a.is_read && <Check className="w-4 h-4 text-emerald-400" />}</div>
                <p className="text-sm text-slate-400 mt-2 whitespace-pre-wrap">{a.message}</p>
                <div className="text-xs text-slate-500 mt-2">Published {a.publish_date}{a.expiry_date && ` · Expires ${a.expiry_date}`}</div>
              </div>
              <div className="flex gap-1">
                {!a.is_read && <Button size="sm" variant="outline" onClick={() => markRead(a.id)} data-testid={`read-${a.id}`}>Mark Read</Button>}
                {isAdmin && <>
                  <Button size="icon" variant="ghost" onClick={() => showStatus(a)} data-testid={`status-${a.id}`}><Eye className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setForm(a); setOpen(true); }}><Edit3 className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(a.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                </>}
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="card-surface p-8 text-center text-slate-500">No announcements.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="card-surface max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Announcement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input data-testid="ann-title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Message</Label><Textarea data-testid="ann-message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className="bg-[#060F1E] border-white/10" rows={5} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="bg-[#060F1E] border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="important">Important</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Publish Date</Label><Input type="date" value={form.publish_date} onChange={e => setForm({ ...form, publish_date: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
              <div><Label>Expiry (opt.)</Label><Input type="date" value={form.expiry_date || ""} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="btn-primary" onClick={save} data-testid="save-announcement-button">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusOpen} onOpenChange={(o) => !o && setStatusOpen(null)}>
        <DialogContent className="card-surface max-w-2xl">
          <DialogHeader><DialogTitle>Read Status — {statusOpen?.title}</DialogTitle></DialogHeader>
          {statusData && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="card-surface p-3"><div className="text-2xl font-bold">{statusData.total_leaders}</div><div className="text-xs text-slate-500">Total</div></div>
                <div className="card-surface p-3"><div className="text-2xl font-bold text-emerald-400">{statusData.read_count}</div><div className="text-xs text-slate-500">Read</div></div>
                <div className="card-surface p-3"><div className="text-2xl font-bold text-red-400">{statusData.unread_count}</div><div className="text-xs text-slate-500">Unread</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm max-h-80 overflow-y-auto">
                <div><div className="text-emerald-400 uppercase text-xs mb-2 tracking-widest">Read</div><ul className="space-y-1">{statusData.read_leaders.map(l => <li key={l.leader_id} className="text-slate-300">{l.name} · <span className="text-slate-500">{l.leader_id}</span></li>)}</ul></div>
                <div><div className="text-red-400 uppercase text-xs mb-2 tracking-widest">Unread</div><ul className="space-y-1">{statusData.unread_leaders.map(l => <li key={l.leader_id} className="text-slate-300">{l.name} · <span className="text-slate-500">{l.leader_id}</span></li>)}</ul></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
