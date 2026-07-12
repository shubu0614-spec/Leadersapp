import React, { useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit3 } from "lucide-react";

const empty = { title: "", date: "", time: "", location: "", inspection_type: "General", description: "", remarks: "", status: "pending" };
const STATUS = { pending: "bg-amber-500/20 text-amber-300", completed: "bg-emerald-500/20 text-emerald-300", cancelled: "bg-red-500/20 text-red-300" };

export default function Inspections() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = async () => { const { data } = await api.get("/inspections"); setList(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api.put(`/inspections/${editing.id}`, form);
      else await api.post("/inspections", form);
      toast.success("Saved"); setOpen(false); setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const del = async (id) => { try { await api.delete(`/inspections/${id}`); toast.success("Deleted"); load(); } catch (e) { toast.error(formatError(e.response?.data?.detail)); } };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="inspections-title">Inspections</h1><p className="text-slate-400 text-sm mt-1">Create and track inspection records.</p></div>
        <Button onClick={() => { setForm(empty); setEditing(null); setOpen(true); }} className="btn-primary" data-testid="add-inspection-button"><Plus className="w-4 h-4 mr-1" /> New Inspection</Button>
      </div>
      <div className="card-surface p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-white/10">
              <th className="py-3 px-2">Title</th><th className="py-3 px-2">Type</th><th className="py-3 px-2">Date/Time</th><th className="py-3 px-2">Location</th><th className="py-3 px-2">Status</th><th className="py-3 px-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(i => (
              <tr key={i.id} className="border-b border-white/5">
                <td className="py-3 px-2 font-medium">{i.title}</td><td className="py-3 px-2 text-slate-400">{i.inspection_type}</td>
                <td className="py-3 px-2 text-xs">{i.date} {i.time}</td><td className="py-3 px-2 text-slate-400">{i.location}</td>
                <td className="py-3 px-2"><span className={`text-xs px-2 py-1 rounded ${STATUS[i.status]}`}>{i.status}</span></td>
                <td className="py-3 px-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setForm(i); setOpen(true); }}><Edit3 className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(i.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No inspections yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="card-surface max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Inspection</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Title</Label><Input data-testid="inspection-title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Time</Label><Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Type</Label><Input value={form.inspection_type} onChange={e => setForm({ ...form, inspection_type: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-[#060F1E] border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="btn-primary" onClick={save} data-testid="save-inspection-button">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
