import React, { useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileDown, Trophy } from "lucide-react";

const TYPES = ["Best Leader of the Month", "Perfect Attendance", "Outstanding Duty Performance", "Appreciation Certificate", "Custom Certificate"];

export default function Certificates() {
  const [leaders, setLeaders] = useState([]);
  const [form, setForm] = useState({ leader_id: "", cert_type: TYPES[0], description: "", date: new Date().toISOString().slice(0, 10) });

  useEffect(() => { (async () => { const { data } = await api.get("/leaders", { params: { role: "leader" } }); setLeaders(data); })(); }, []);

  const generate = async () => {
    if (!form.leader_id) return toast.error("Select a leader");
    try {
      const res = await api.post("/certificates/generate", form, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
      toast.success("Certificate generated");
    } catch { toast.error("Failed to generate certificate"); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="certificates-title">Achievement Certificates</h1>
        <p className="text-slate-400 text-sm mt-1">Generate professional certificates as PDF.</p>
      </div>
      <div className="card-surface p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center"><Trophy className="w-6 h-6 text-amber-400" /></div>
          <div><div className="text-sm uppercase tracking-widest text-slate-400">Certificate Builder</div><div className="font-bold" style={{ fontFamily: "Space Grotesk" }}>Design & Print</div></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Leader</Label>
            <Select value={form.leader_id} onValueChange={v => setForm({ ...form, leader_id: v })}>
              <SelectTrigger data-testid="cert-leader" className="bg-[#060F1E] border-white/10"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{leaders.map(l => <SelectItem key={l.leader_id} value={l.leader_id}>{l.name} ({l.leader_id})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Certificate Type</Label>
            <Select value={form.cert_type} onValueChange={v => setForm({ ...form, cert_type: v })}>
              <SelectTrigger data-testid="cert-type" className="bg-[#060F1E] border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-[#060F1E] border-white/10" placeholder="For exceptional dedication to..." /></div>
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-[#060F1E] border-white/10" /></div>
        </div>
        <Button onClick={generate} className="btn-primary mt-6" data-testid="generate-cert-button"><FileDown className="w-4 h-4 mr-1" /> Generate PDF</Button>
      </div>
    </div>
  );
}
