import React, { useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, MapPin, Clock, Calendar } from "lucide-react";

const empty = { name: "", description: "", venue: "", date: "", time: "", instructions: "" };
export default function Events() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const isAdmin = user?.role === "super_admin";

  const load = async () => { const { data } = await api.get("/events"); setList(data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editing) await api.put(`/events/${editing.id}`, form);
      else await api.post("/events", form);
      toast.success("Saved");
      setOpen(false); setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };
  const del = async (id) => { try { await api.delete(`/events/${id}`); toast.success("Deleted"); load(); } catch (e) { toast.error(formatError(e.response?.data?.detail)); } };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="events-title">Events</h1><p className="text-slate-400 text-sm mt-1">Upcoming school events and activities.</p></div>
        {isAdmin && <Button onClick={() => { setForm(empty); setEditing(null); setOpen(true); }} className="btn-primary" data-testid="add-event-button"><Plus className="w-4 h-4 mr-1" /> Add Event</Button>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger">
        {list.map(e => (
          <div key={e.id} className="card-surface p-5" data-testid={`event-${e.id}`}>
            <div className="flex justify-between">
              <div className="flex-1"><h3 className="font-semibold">{e.name}</h3><p className="text-xs text-slate-500 mt-1">{e.description}</p></div>
              {isAdmin && (
                <div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => { setEditing(e); setForm(e); setOpen(true); }} data-testid={`edit-event-${e.id}`}><Edit3 className="w-4 h-4" /></Button><Button size="icon" variant="ghost" onClick={() => del(e.id)} data-testid={`del-event-${e.id}`}><Trash2 className="w-4 h-4 text-red-400" /></Button></div>
              )}
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-400">
              <div className="flex items-center gap-2"><Calendar className="w-3 h-3 text-sky-400" /> {e.date}</div>
              <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-sky-400" /> {e.time}</div>
              {e.venue && <div className="flex items-center gap-2"><MapPin className="w-3 h-3 text-sky-400" /> {e.venue}</div>}
            </div>
            {e.instructions && <div className="mt-3 text-xs text-slate-400 border-t border-white/5 pt-2">{e.instructions}</div>}
          </div>
        ))}
        {list.length === 0 && <div className="card-surface p-8 text-center text-slate-500 col-span-full">No events.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="card-surface max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input data-testid="event-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Date</Label><Input type="date" data-testid="event-date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Time</Label><Input type="time" data-testid="event-time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2"><Label>Venue</Label><Input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2"><Label>Instructions</Label><Textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="btn-primary" onClick={save} data-testid="save-event-button">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
