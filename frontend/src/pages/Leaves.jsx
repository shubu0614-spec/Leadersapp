import React, { useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Check, X } from "lucide-react";

const STATUS_COLORS = {
  pending: "bg-amber-500/20 text-amber-300",
  approved: "bg-emerald-500/20 text-emerald-300",
  rejected: "bg-red-500/20 text-red-300",
  cancelled: "bg-slate-500/20 text-slate-300",
};

export default function Leaves() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "Sick Leave", reason: "", start_date: "", end_date: "", description: "", is_emergency: false });
  const [remarks, setRemarks] = useState({});

  const isAdmin = user?.role === "super_admin";

  const load = async () => {
    const { data } = await api.get("/leaves", { params: filter !== "all" ? { status: filter } : {} });
    setList(data);
  };
  useEffect(() => { load(); }, [filter]);

  const submit = async () => {
    try {
      await api.post("/leaves", form);
      toast.success("Leave submitted");
      setOpen(false); setForm({ leave_type: "Sick Leave", reason: "", start_date: "", end_date: "", description: "", is_emergency: false });
      load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const review = async (id, action) => {
    try {
      await api.post(`/leaves/${id}/${action}`, { remarks: remarks[id] || "" });
      toast.success(`Leave ${action}d`);
      load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const cancel = async (id) => {
    try { await api.post(`/leaves/${id}/cancel`); toast.success("Cancelled"); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="leaves-title">Leave Management</h1>
          <p className="text-slate-400 text-sm mt-1">Apply for leave, review requests, and track history.</p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setOpen(true)} className="btn-primary" data-testid="apply-leave-button"><Plus className="w-4 h-4 mr-1" /> Apply Leave</Button>
        )}
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-[#0F1A2E] border border-white/10">
          <TabsTrigger value="all" data-testid="filter-all">All</TabsTrigger>
          <TabsTrigger value="pending" data-testid="filter-pending">Pending</TabsTrigger>
          <TabsTrigger value="approved" data-testid="filter-approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="filter-rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="card-surface p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-white/10">
              <th className="py-3 px-2">Leader</th>
              <th className="py-3 px-2">Type</th>
              <th className="py-3 px-2">Period</th>
              <th className="py-3 px-2">Reason</th>
              <th className="py-3 px-2">Status</th>
              <th className="py-3 px-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(l => (
              <tr key={l.id} className="border-b border-white/5" data-testid={`leave-row-${l.id}`}>
                <td className="py-3 px-2"><div className="font-medium">{l.leader_name}</div><div className="text-xs font-mono text-sky-400">{l.leader_id}</div></td>
                <td className="py-3 px-2">{l.leave_type}{l.is_emergency && <span className="ml-2 text-xs text-red-400">EMERGENCY</span>}</td>
                <td className="py-3 px-2 text-xs">{l.start_date} → {l.end_date}</td>
                <td className="py-3 px-2 text-slate-400 max-w-xs truncate">{l.reason}</td>
                <td className="py-3 px-2"><span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[l.status]}`}>{l.status}</span></td>
                <td className="py-3 px-2 text-right">
                  {isAdmin && l.status === "pending" && (
                    <div className="inline-flex gap-2 items-center">
                      <Input placeholder="Remarks" value={remarks[l.id] || ""} onChange={e => setRemarks({ ...remarks, [l.id]: e.target.value })} className="h-8 w-32 bg-[#060F1E] border-white/10" />
                      <Button size="sm" onClick={() => review(l.id, "approve")} className="bg-emerald-600 hover:bg-emerald-700" data-testid={`approve-${l.id}`}><Check className="w-4 h-4" /></Button>
                      <Button size="sm" onClick={() => review(l.id, "reject")} className="bg-red-600 hover:bg-red-700" data-testid={`reject-${l.id}`}><X className="w-4 h-4" /></Button>
                    </div>
                  )}
                  {!isAdmin && l.leader_id === user?.leader_id && l.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => cancel(l.id)} data-testid={`cancel-${l.id}`}>Cancel</Button>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No leaves.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="card-surface max-w-lg">
          <DialogHeader><DialogTitle>Apply Leave</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Leave Type</Label>
              <Select value={form.leave_type} onValueChange={v => setForm({ ...form, leave_type: v })}>
                <SelectTrigger data-testid="leave-type" className="bg-[#060F1E] border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                  <SelectItem value="Personal Leave">Personal Leave</SelectItem>
                  <SelectItem value="Emergency Leave">Emergency Leave</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Emergency?</Label>
              <Select value={form.is_emergency ? "yes" : "no"} onValueChange={v => setForm({ ...form, is_emergency: v === "yes" })}>
                <SelectTrigger className="bg-[#060F1E] border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Start Date</Label><Input data-testid="leave-start" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>End Date</Label><Input data-testid="leave-end" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2"><Label>Reason</Label><Input data-testid="leave-reason" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="btn-primary" onClick={submit} data-testid="submit-leave-button">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
