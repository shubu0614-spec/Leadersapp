import React, { useEffect, useState, useRef } from "react";
import { api, formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { QrCode, Camera, CheckCircle2, XCircle, AlertCircle, Clock, Sun, ClipboardList, Play, Square } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Html5Qrcode } from "html5-qrcode";

const SESSIONS = [
  { key: "break1", label: "Break 1" },
  { key: "break2", label: "Break 2" },
  { key: "assembly", label: "Assembly" },
];
const STATUSES = [
  { key: "present", label: "Present", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", icon: CheckCircle2 },
  { key: "late", label: "Late", color: "bg-amber-500/20 text-amber-300 border-amber-500/40", icon: Clock },
  { key: "absent", label: "Absent", color: "bg-red-500/20 text-red-300 border-red-500/40", icon: XCircle },
  { key: "pending", label: "Pending Verification", color: "bg-slate-500/20 text-slate-300 border-slate-500/40", icon: AlertCircle },
];

export default function Attendance() {
  const { user } = useAuth();
  const [session, setSession] = useState("break1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaders, setLeaders] = useState([]);
  const [records, setRecords] = useState({});
  const [scanOpen, setScanOpen] = useState(false);
  const [scanAction, setScanAction] = useState("start"); // start | end
  const [settings, setSettings] = useState({});
  const [holiday, setHoliday] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [leaveCheckOpen, setLeaveCheckOpen] = useState(false);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [popup, setPopup] = useState(null); // {leader, duty_place, is_replacement, replacing}
  const scannerRef = useRef(null);
  const scannerInstance = useRef(null);

  const canMark = user?.role === "super_admin";

  const load = async () => {
    const [lRes, aRes, sRes, hRes] = await Promise.all([
      api.get("/leaders", { params: { role: "leader" } }),
      api.get("/attendance", { params: { session, date } }),
      api.get("/settings"),
      api.get("/holidays/check", { params: { date } }),
    ]);
    setLeaders(lRes.data);
    const map = {};
    aRes.data.forEach(r => { map[r.leader_id] = r; });
    setRecords(map);
    setSettings(sRes.data);
    setHoliday(hRes.data.is_holiday ? hRes.data.holiday : null);
  };

  useEffect(() => { load(); }, [session, date]);

  const mark = async (leader_id, status) => {
    if (!canMark) return;
    if (holiday) return toast.error("Today is a holiday");
    try {
      const { data } = await api.post("/attendance/mark", { leader_id, session, status, date });
      setRecords(prev => ({ ...prev, [leader_id]: data }));
      toast.success(`Marked ${status}`);
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const toggleHoliday = async () => {
    try {
      if (holiday) {
        await api.delete(`/holidays/${date}`);
        toast.success("Holiday removed");
      } else {
        await api.post("/holidays", { date, reason: "Marked from attendance" });
        toast.success("Marked as holiday");
      }
      load();
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const openSummary = async () => {
    try {
      const { data } = await api.get("/attendance/summary-all", { params: { date } });
      setSummary(data);
      setSummaryOpen(true);
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const preflightLeaveCheck = async (action) => {
    if (holiday) return toast.error("Today is a holiday");
    try {
      const { data } = await api.get("/leaves/on-date", { params: { date } });
      if (data && data.length > 0) {
        setApprovedLeaves(data);
        setScanAction(action);
        setLeaveCheckOpen(true);
        return;
      }
    } catch {}
    startScan(action);
  };

  const startScan = async (action = "start") => {
    setScanAction(action);
    setScanOpen(true);
    setTimeout(async () => {
      try {
        const el = document.getElementById("qr-reader");
        if (!el) return;
        const inst = new Html5Qrcode("qr-reader");
        scannerInstance.current = inst;
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          async (decoded) => {
            try {
              const { data } = await api.post("/attendance/qr-scan", { qr_token: decoded, session, status: "present", action });
              // Pause scanning until confirm
              try { await inst.pause(true); } catch {}
              setPopup({
                leader: data.leader,
                duty_place: data.duty_place,
                is_replacement: data.is_replacement,
                replacing: data.replacing,
                record: data.record,
                action,
              });
            } catch (e) {
              toast.error(formatError(e.response?.data?.detail));
            }
          },
          () => {}
        );
      } catch (e) {
        toast.error("Camera permission is required for QR Attendance.");
        setScanOpen(false);
      }
    }, 100);
  };

  const stopScan = async () => {
    try {
      if (scannerInstance.current) {
        await scannerInstance.current.stop();
        await scannerInstance.current.clear();
        scannerInstance.current = null;
      }
    } catch {}
    setScanOpen(false);
  };

  const confirmPopup = async () => {
    // Refresh records
    if (popup?.leader) {
      setRecords(prev => ({ ...prev, [popup.leader.leader_id]: popup.record }));
      toast.success(`${popup.leader.name} — ${popup.action === "end" ? "Duty Ended" : "Duty Started"}`);
    }
    setPopup(null);
    try { await scannerInstance.current?.resume(); } catch {}
  };

  const cancelPopup = async () => {
    setPopup(null);
    try { await scannerInstance.current?.resume(); } catch {}
  };

  const qrEnabled = settings.mod_qr_attendance && (settings.attendance_mode === "qr" || settings.attendance_mode === "hybrid");
  const manualEnabled = settings.attendance_mode === "manual" || settings.attendance_mode === "hybrid";

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="attendance-title">Duty Attendance</h1>
          <p className="text-slate-400 text-sm mt-1">Independent sessions: Break 1, Break 2, and Assembly.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-[#060F1E] border border-white/10 rounded-md px-3 py-2 text-sm" data-testid="attendance-date" />
          <Button variant="outline" onClick={openSummary} data-testid="summary-button"><ClipboardList className="w-4 h-4 mr-1" /> Attendance Summary</Button>
          {canMark && (
            <Button variant="outline" onClick={toggleHoliday} data-testid="holiday-toggle" className={holiday ? "bg-amber-500/10 border-amber-500/40" : ""}>
              <Sun className="w-4 h-4 mr-1" /> {holiday ? "Remove Holiday" : "Mark Today as Holiday"}
            </Button>
          )}
          {canMark && qrEnabled && !holiday && (
            <>
              <Button className="btn-primary" onClick={() => preflightLeaveCheck("start")} data-testid="scan-qr-button">
                <Play className="w-4 h-4 mr-1" /> Start Duty
              </Button>
              <Button variant="outline" onClick={() => preflightLeaveCheck("end")} data-testid="end-duty-button">
                <Square className="w-4 h-4 mr-1" /> End Duty
              </Button>
            </>
          )}
        </div>
      </div>

      {holiday && (
        <div className="card-surface p-4 border-l-4 border-amber-400 flex items-center gap-3" data-testid="holiday-banner">
          <Sun className="w-5 h-5 text-amber-400" />
          <div><div className="font-semibold">Holiday Mode</div><div className="text-xs text-slate-400">{holiday.reason || "No attendance, absences, or penalties today."}</div></div>
        </div>
      )}

      <Tabs value={session} onValueChange={setSession}>
        <TabsList className="bg-[#0F1A2E] border border-white/10">
          {SESSIONS.map(s => (
            <TabsTrigger key={s.key} value={s.key} data-testid={`session-tab-${s.key}`} className="data-[state=active]:bg-[#1D4ED8] data-[state=active]:text-white">
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Progress live counter */}
      <div className="card-surface p-4 grid grid-cols-3 text-center" data-testid="scan-progress">
        <div><div className="text-2xl font-bold" style={{ fontFamily: "Space Grotesk" }}>{leaders.length}</div><div className="text-xs uppercase text-slate-500 tracking-widest">Total</div></div>
        <div><div className="text-2xl font-bold text-emerald-400" style={{ fontFamily: "Space Grotesk" }}>{Object.keys(records).length}</div><div className="text-xs uppercase text-slate-500 tracking-widest">Scanned</div></div>
        <div><div className="text-2xl font-bold text-red-400" style={{ fontFamily: "Space Grotesk" }}>{Math.max(0, leaders.length - Object.keys(records).length)}</div><div className="text-xs uppercase text-slate-500 tracking-widest">Remaining</div></div>
      </div>

      <div className="card-surface p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-slate-500 border-b border-white/10">
                <th className="py-3 px-2">Leader</th>
                <th className="py-3 px-2">Leader ID</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2">Start</th>
                <th className="py-3 px-2">End</th>
                <th className="py-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map(l => {
                const rec = records[l.leader_id];
                return (
                  <tr key={l.id} className="border-b border-white/5" data-testid={`att-row-${l.leader_id}`}>
                    <td className="py-3 px-2 font-medium">{l.name}</td>
                    <td className="py-3 px-2 font-mono text-sky-400">{l.leader_id}</td>
                    <td className="py-3 px-2">
                      {rec ? (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${STATUSES.find(s => s.key === rec.status)?.color}`}>
                          {rec.status}
                          {rec.method === "qr" && <QrCode className="w-3 h-3" />}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Not marked</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-xs text-slate-400">{rec?.start_time ? new Date(rec.start_time).toLocaleTimeString() : "-"}</td>
                    <td className="py-3 px-2 text-xs text-slate-400">{rec?.end_time ? new Date(rec.end_time).toLocaleTimeString() : "-"}</td>
                    <td className="py-3 px-2 text-right">
                      {canMark && manualEnabled && !holiday && (
                        <div className="inline-flex gap-1 flex-wrap justify-end">
                          {STATUSES.map(s => (
                            <button
                              key={s.key}
                              onClick={() => mark(l.leader_id, s.key)}
                              data-testid={`mark-${l.leader_id}-${s.key}`}
                              className={`text-xs px-2 py-1 rounded border ${rec?.status === s.key ? s.color : "border-white/10 text-slate-400 hover:border-sky-400/40 hover:text-white"}`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {leaders.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">No leaders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scanner */}
      <Dialog open={scanOpen} onOpenChange={(o) => { if (!o) stopScan(); }}>
        <DialogContent className="card-surface max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="w-4 h-4" /> {scanAction === "end" ? "End Duty" : "Start Duty"} — {SESSIONS.find(s => s.key === session)?.label}</DialogTitle></DialogHeader>
          <div id="qr-reader" ref={scannerRef} className="rounded-lg overflow-hidden" />
          <p className="text-xs text-slate-400">Point the camera at the Leader ID card QR code.</p>
          <Button onClick={stopScan} variant="outline" data-testid="close-scanner">Close</Button>
        </DialogContent>
      </Dialog>

      {/* Confirm popup after scan */}
      <Dialog open={!!popup} onOpenChange={(o) => !o && cancelPopup()}>
        <DialogContent className="card-surface" data-testid="scan-confirm-dialog">
          <DialogHeader><DialogTitle>Confirm Attendance</DialogTitle></DialogHeader>
          {popup && (
            <div className="space-y-2">
              <div><span className="text-slate-500 text-xs uppercase tracking-widest">Leader Name</span><div className="text-lg font-semibold">{popup.leader.name}</div></div>
              <div><span className="text-slate-500 text-xs uppercase tracking-widest">Leader ID</span><div className="font-mono text-sky-400">{popup.leader.leader_id}</div></div>
              <div><span className="text-slate-500 text-xs uppercase tracking-widest">Session</span><div>{SESSIONS.find(s => s.key === session)?.label}</div></div>
              {popup.duty_place && <div><span className="text-slate-500 text-xs uppercase tracking-widest">Assigned Duty Place</span><div>{popup.duty_place}</div></div>}
              {popup.is_replacement && <div className="text-sm text-amber-400">Replacement duty (+10 pts) · replacing {popup.replacing}</div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={cancelPopup} data-testid="cancel-scan">Cancel</Button>
            <Button className="btn-primary" onClick={confirmPopup} data-testid="confirm-scan">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave check preflight */}
      <Dialog open={leaveCheckOpen} onOpenChange={setLeaveCheckOpen}>
        <DialogContent className="card-surface" data-testid="leave-check-dialog">
          <DialogHeader><DialogTitle>Approved Leaves Today</DialogTitle><DialogDescription className="text-slate-400">These leaders are on approved leave for {date}.</DialogDescription></DialogHeader>
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {approvedLeaves.map(l => (
              <li key={l.id} className="text-sm flex items-center justify-between border-b border-white/5 py-2">
                <div><div className="font-medium">{l.leader_name}</div><div className="text-xs font-mono text-sky-400">{l.leader_id}</div></div>
                <div className="text-xs text-slate-400">{l.leave_type}</div>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveCheckOpen(false)} data-testid="leave-cancel">Cancel</Button>
            <Button className="btn-primary" onClick={() => { setLeaveCheckOpen(false); startScan(scanAction); }} data-testid="leave-verify-all">Verify All Duties</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="card-surface max-w-3xl" data-testid="summary-dialog">
          <DialogHeader><DialogTitle>Attendance Summary — {summary?.date}</DialogTitle></DialogHeader>
          {summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-3 text-center">
                <div className="card-surface p-3"><div className="text-2xl font-bold" style={{ fontFamily: "Space Grotesk" }}>{summary.total_leaders}</div><div className="text-xs text-slate-500 uppercase tracking-widest">Total</div></div>
                <div className="card-surface p-3"><div className="text-2xl font-bold text-emerald-400" style={{ fontFamily: "Space Grotesk" }}>{summary.present}</div><div className="text-xs text-slate-500 uppercase tracking-widest">Present</div></div>
                <div className="card-surface p-3"><div className="text-2xl font-bold text-red-400" style={{ fontFamily: "Space Grotesk" }}>{summary.absent}</div><div className="text-xs text-slate-500 uppercase tracking-widest">Absent</div></div>
                <div className="card-surface p-3"><div className="text-2xl font-bold text-amber-400" style={{ fontFamily: "Space Grotesk" }}>{summary.on_leave}</div><div className="text-xs text-slate-500 uppercase tracking-widest">On Leave</div></div>
                <div className="card-surface p-3"><div className="text-2xl font-bold text-sky-400" style={{ fontFamily: "Space Grotesk" }}>{summary.attendance_percentage}%</div><div className="text-xs text-slate-500 uppercase tracking-widest">Attendance</div></div>
              </div>
              <div className="max-h-80 overflow-y-auto card-surface p-3">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-white/10">
                    <th className="py-2 px-2">Leader</th><th className="py-2 px-2">Present</th><th className="py-2 px-2">Late</th><th className="py-2 px-2">Absent</th><th className="py-2 px-2">%</th>
                  </tr></thead>
                  <tbody>
                    {summary.per_leader.map(p => (
                      <tr key={p.leader_id} className="border-b border-white/5">
                        <td className="py-2 px-2"><div className="font-medium">{p.name}</div><div className="text-xs font-mono text-sky-400">{p.leader_id}</div></td>
                        <td className="py-2 px-2 text-emerald-400">{p.present}</td>
                        <td className="py-2 px-2 text-amber-400">{p.late}</td>
                        <td className="py-2 px-2 text-red-400">{p.absent}</td>
                        <td className="py-2 px-2 text-sky-400">{p.percentage}%{p.on_leave && <span className="ml-2 text-xs text-amber-400">Leave</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
