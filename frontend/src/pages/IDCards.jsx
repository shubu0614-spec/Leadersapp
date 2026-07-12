import React, { useEffect, useState } from "react";
import { api, formatError, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileDown, RefreshCw, Search, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function IDCards() {
  const [leaders, setLeaders] = useState([]);
  const [q, setQ] = useState("");
  const [settings, setSettings] = useState({});

  const load = async () => {
    const [l, s] = await Promise.all([api.get("/leaders", { params: { q } }), api.get("/settings")]);
    setLeaders(l.data);
    setSettings(s.data);
  };
  useEffect(() => { load(); }, [q]);

  const download = async (leader_id) => {
    try {
      const res = await api.get(`/id-cards/${leader_id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch { toast.error("Failed to generate PDF"); }
  };

  const regen = async (leader_id) => {
    try { await api.post(`/leaders/${leader_id}/regenerate-qr`); toast.success("QR regenerated"); load(); }
    catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="idcards-title">Leader ID Cards</h1><p className="text-slate-400 text-sm mt-1">Generate, preview, and download professional ID cards.</p></div>
        <div className="flex gap-3 items-center">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search leaders" className="pl-10 bg-[#060F1E] border-white/10" data-testid="idcard-search" />
          </div>
          <Button onClick={async () => {
            try {
              const res = await api.get("/id-cards/sheet-pdf", { responseType: "blob" });
              window.open(URL.createObjectURL(res.data), "_blank");
            } catch { toast.error("Failed to generate sheet"); }
          }} className="btn-primary" data-testid="download-sheet-button"><Printer className="w-4 h-4 mr-1" /> Download A4 Sheet</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger">
        {leaders.map(l => (
          <div key={l.id} className="card-surface p-0 overflow-hidden" data-testid={`idcard-${l.leader_id}`}>
            <div className="relative p-4" style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)" }}>
              <div className="text-[10px] uppercase tracking-[0.25em] text-sky-200">{settings.school_name || "School"}</div>
              <div className="text-lg font-bold text-white mt-1" style={{ fontFamily: "Space Grotesk" }}>{l.name}</div>
              <div className="text-xs text-sky-200 mt-1">ID: {l.leader_id}</div>
              <div className="text-xs text-sky-200">{l.position || "-"}</div>
              <div className="absolute right-3 top-3 bg-white p-1.5 rounded">
                <QRCodeSVG value={l.qr_token || l.leader_id} size={56} />
              </div>
            </div>
            <div className="p-3 flex gap-2">
              <Button size="sm" onClick={() => download(l.leader_id)} className="btn-primary flex-1" data-testid={`download-${l.leader_id}`}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
              <Button size="sm" variant="outline" onClick={() => regen(l.leader_id)} data-testid={`regen-${l.leader_id}`}><RefreshCw className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
        {leaders.length === 0 && <div className="card-surface p-8 text-center text-slate-500 col-span-full">No leaders.</div>}
      </div>
    </div>
  );
}
