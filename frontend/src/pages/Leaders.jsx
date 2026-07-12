import React, { useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Search, Trash2, Edit3, KeyRound, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const empty = { leader_id: "", name: "", position: "", department: "", class_name: "", section: "", pin: "", role: "leader" };

export default function Leaders() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [resetOpen, setResetOpen] = useState(null); // leader
  const [newPin, setNewPin] = useState("");

  const load = async () => {
    const { data } = await api.get("/leaders", { params: { q } });
    setList(data);
  };

  useEffect(() => { load(); }, [q]);

  const save = async () => {
    try {
      if (editing) {
        const { pin, leader_id, role, ...update } = form;
        await api.put(`/leaders/${editing.leader_id}`, update);
        toast.success("Leader updated");
      } else {
        if (!/^\d{4}$/.test(form.pin)) return toast.error("PIN must be 4 digits");
        await api.post("/leaders", form);
        toast.success("Leader added");
      }
      setOpen(false); setForm(empty); setEditing(null); load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail) || "Failed"); }
  };

  const del = async (lid) => {
    try { await api.delete(`/leaders/${lid}`); toast.success("Leader deleted"); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const resetPin = async () => {
    try {
      if (!/^\d{4}$/.test(newPin)) return toast.error("PIN must be 4 digits");
      await api.post(`/leaders/${resetOpen.leader_id}/reset-pin`, { new_pin: newPin, force_change: true });
      toast.success("PIN reset. Leader must change on next login.");
      setResetOpen(null); setNewPin("");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const regenQr = async (lid) => {
    try { await api.post(`/leaders/${lid}/regenerate-qr`); toast.success("QR regenerated"); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="leaders-title">Leaders</h1>
          <p className="text-slate-400 text-sm mt-1">Manage student leaders and administrators.</p>
        </div>
        {user?.role === "super_admin" && (
          <Button onClick={() => { setForm(empty); setEditing(null); setOpen(true); }} className="btn-primary" data-testid="add-leader-button">
            <Plus className="w-4 h-4 mr-1" /> Add Leader
          </Button>
        )}
      </div>

      <div className="card-surface p-4">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input data-testid="leaders-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID" className="pl-10 bg-[#060F1E] border-white/10" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-white/10">
                <th className="py-3 px-2">Leader ID</th>
                <th className="py-3 px-2">Name</th>
                <th className="py-3 px-2">Position</th>
                <th className="py-3 px-2">Department</th>
                <th className="py-3 px-2">Role</th>
                <th className="py-3 px-2">Points</th>
                {user?.role === "super_admin" && <th className="py-3 px-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {list.map(l => (
                <tr key={l.id} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`leader-row-${l.leader_id}`}>
                  <td className="py-3 px-2 font-mono text-sky-400">{l.leader_id}</td>
                  <td className="py-3 px-2">{l.name}</td>
                  <td className="py-3 px-2 text-slate-400">{l.position || "-"}</td>
                  <td className="py-3 px-2 text-slate-400">{l.department || "-"}</td>
                  <td className="py-3 px-2"><span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-300">{l.role}</span></td>
                  <td className="py-3 px-2 text-amber-300 font-semibold">{l.points || 0}</td>
                  {user?.role === "super_admin" && (
                    <td className="py-3 px-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(l); setForm({ ...l, pin: "" }); setOpen(true); }} data-testid={`edit-${l.leader_id}`}><Edit3 className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setResetOpen(l)} data-testid={`reset-pin-${l.leader_id}`}><KeyRound className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => regenQr(l.leader_id)} data-testid={`regen-qr-${l.leader_id}`}><RefreshCw className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`delete-${l.leader_id}`}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="card-surface">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete leader?</AlertDialogTitle>
                              <AlertDialogDescription>This permanently removes {l.name}.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid={`cancel-delete-${l.leader_id}`}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del(l.leader_id)} data-testid={`confirm-delete-${l.leader_id}`}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500">No leaders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="card-surface max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Leader" : "Add Leader"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Leader ID</Label><Input data-testid="form-leader-id" disabled={!!editing} value={form.leader_id} onChange={e => setForm({ ...form, leader_id: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Name</Label><Input data-testid="form-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Position</Label><Input data-testid="form-position" value={form.position || ""} onChange={e => setForm({ ...form, position: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Department</Label><Input data-testid="form-department" value={form.department || ""} onChange={e => setForm({ ...form, department: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Class</Label><Input value={form.class_name || ""} onChange={e => setForm({ ...form, class_name: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Section</Label><Input value={form.section || ""} onChange={e => setForm({ ...form, section: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })} disabled={!!editing}>
                <SelectTrigger data-testid="form-role" className="bg-[#060F1E] border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="leader">Leader</SelectItem><SelectItem value="admin">Administrator</SelectItem></SelectContent>
              </Select>
            </div>
            {!editing && (
              <div><Label>4-digit PIN</Label><Input data-testid="form-pin" maxLength={4} inputMode="numeric" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} className="bg-[#060F1E] border-white/10" /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="btn-primary" data-testid="save-leader-button">{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetOpen} onOpenChange={(o) => !o && setResetOpen(null)}>
        <DialogContent className="card-surface">
          <DialogHeader><DialogTitle>Reset PIN for {resetOpen?.name}</DialogTitle></DialogHeader>
          <div>
            <Label>New 4-digit PIN</Label>
            <Input data-testid="reset-pin-input" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} className="bg-[#060F1E] border-white/10" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(null)}>Cancel</Button>
            <Button onClick={resetPin} className="btn-primary" data-testid="confirm-reset-pin">Reset PIN</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
