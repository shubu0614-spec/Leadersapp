import React, { useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Settings() {
  const [s, setS] = useState(null);
  useEffect(() => { (async () => { const { data } = await api.get("/settings"); setS(data); })(); }, []);
  if (!s) return <div className="text-slate-400">Loading...</div>;

  const upd = (k, v) => setS({ ...s, [k]: v });
  const save = async () => {
    try {
      const { data } = await api.put("/settings", s);
      setS(data);
      toast.success("Settings saved");
    } catch (e) { toast.error(formatError(e.response?.data?.detail)); }
  };

  const uploadLogo = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => upd("school_logo_base64", r.result);
    r.readAsDataURL(f);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="settings-title">Settings</h1><p className="text-slate-400 text-sm mt-1">Configure your school, modules, and preferences.</p></div>
        <Button onClick={save} className="btn-primary" data-testid="save-settings-button">Save Changes</Button>
      </div>

      <Tabs defaultValue="school">
        <TabsList className="bg-[#0F1A2E] border border-white/10">
          <TabsTrigger value="school" data-testid="tab-school">School</TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-attendance">Attendance</TabsTrigger>
          <TabsTrigger value="inspection" data-testid="tab-inspection">Inspection</TabsTrigger>
          <TabsTrigger value="leave" data-testid="tab-leave">Leave</TabsTrigger>
          <TabsTrigger value="report" data-testid="tab-report">Weekly Reports</TabsTrigger>
          <TabsTrigger value="notif" data-testid="tab-notif">Notifications</TabsTrigger>
          <TabsTrigger value="modules" data-testid="tab-modules">Modules</TabsTrigger>
          <TabsTrigger value="appearance" data-testid="tab-appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="school" className="card-surface p-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>School Name</Label><Input data-testid="school-name" value={s.school_name} onChange={e => upd("school_name", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Academic Year</Label><Input value={s.academic_year} onChange={e => upd("academic_year", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Principal Name</Label><Input value={s.principal_name} onChange={e => upd("principal_name", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Leadership Coordinator</Label><Input value={s.leadership_coordinator} onChange={e => upd("leadership_coordinator", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={s.school_address} onChange={e => upd("school_address", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Contact Number</Label><Input value={s.contact_number} onChange={e => upd("contact_number", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Email</Label><Input value={s.email} onChange={e => upd("email", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
            <div className="col-span-2">
              <Label>School Logo</Label>
              <div className="flex items-center gap-4 mt-2">
                {s.school_logo_base64 && <img src={s.school_logo_base64} alt="logo" className="w-16 h-16 object-contain bg-white/5 rounded" />}
                <Input type="file" accept="image/*" onChange={uploadLogo} className="bg-[#060F1E] border-white/10" data-testid="logo-upload" />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="card-surface p-6 mt-4 space-y-4">
          <div>
            <Label>Attendance Mode</Label>
            <Select value={s.attendance_mode} onValueChange={v => upd("attendance_mode", v)}>
              <SelectTrigger data-testid="attendance-mode" className="bg-[#060F1E] border-white/10 max-w-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Attendance</SelectItem>
                <SelectItem value="qr">QR Code Attendance</SelectItem>
                <SelectItem value="hybrid">Hybrid (Manual + QR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3"><Switch checked={s.mod_qr_attendance} onCheckedChange={v => upd("mod_qr_attendance", v)} data-testid="qr-toggle" /><span>QR Attendance Module Enabled</span></div>
          <div className="flex items-center gap-3"><Switch checked={s.duty_assignment_enabled} onCheckedChange={v => upd("duty_assignment_enabled", v)} data-testid="duty-toggle" /><span>Duty Assignment System (uses uploaded weekly schedule)</span></div>
          <p className="text-xs text-slate-500">When ON, upload the official weekly duty schedule from the Duty Schedule module. Duties are never auto-generated.</p>
        </TabsContent>

        <TabsContent value="inspection" className="card-surface p-6 mt-4 space-y-4">
          <div><Label>Inspection Mode</Label>
            <Select value={s.inspection_mode || "manual"} onValueChange={v => upd("inspection_mode", v)}>
              <SelectTrigger data-testid="inspection-mode" className="bg-[#060F1E] border-white/10 max-w-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (Super Admin selects date)</SelectItem>
                <SelectItem value="automatic">Automatic (One date per month)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {s.inspection_mode === "manual" && (
            <div><Label>Inspection Date</Label><Input type="date" value={s.inspection_manual_date || ""} onChange={e => upd("inspection_manual_date", e.target.value)} className="bg-[#060F1E] border-white/10 max-w-sm" data-testid="inspection-date" /></div>
          )}
          <div className="col-span-2 space-y-2">
            <Label>Principal Signature Image</Label>
            <div className="flex items-center gap-3">
              {s.principal_signature_base64 && <img src={s.principal_signature_base64} className="h-12 bg-white/10 rounded p-1" alt="p-sig" />}
              <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => upd("principal_signature_base64", r.result); r.readAsDataURL(f); }} className="bg-[#060F1E] border-white/10" />
            </div>
            <Label>Coordinator Signature Image</Label>
            <div className="flex items-center gap-3">
              {s.coordinator_signature_base64 && <img src={s.coordinator_signature_base64} className="h-12 bg-white/10 rounded p-1" alt="c-sig" />}
              <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => upd("coordinator_signature_base64", r.result); r.readAsDataURL(f); }} className="bg-[#060F1E] border-white/10" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leave" className="card-surface p-6 mt-4 space-y-4">
          <div><Label>Maximum Leave Limit</Label><Input type="number" value={s.max_leave_limit} onChange={e => upd("max_leave_limit", Number(e.target.value))} className="bg-[#060F1E] border-white/10 max-w-xs" /></div>
          <div><Label>Leave Submission Window (days)</Label><Input type="number" value={s.leave_submission_window_days} onChange={e => upd("leave_submission_window_days", Number(e.target.value))} className="bg-[#060F1E] border-white/10 max-w-xs" /></div>
          <div className="flex items-center gap-3"><Switch checked={s.emergency_leave_enabled} onCheckedChange={v => upd("emergency_leave_enabled", v)} /><span>Emergency Leave Enabled</span></div>
          <div className="flex items-center gap-3"><Switch checked={s.leave_approval_required} onCheckedChange={v => upd("leave_approval_required", v)} /><span>Approval Required</span></div>
        </TabsContent>

        <TabsContent value="report" className="card-surface p-6 mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Open Day</Label><Input value={s.weekly_report_open_day} onChange={e => upd("weekly_report_open_day", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Close Day</Label><Input value={s.weekly_report_close_day} onChange={e => upd("weekly_report_close_day", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
            <div><Label>Deadline Time</Label><Input value={s.weekly_report_deadline_time} onChange={e => upd("weekly_report_deadline_time", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
          </div>
          <div className="flex items-center gap-3"><Switch checked={s.weekly_report_late_permission} onCheckedChange={v => upd("weekly_report_late_permission", v)} /><span>Allow Late Submissions</span></div>
          <div className="flex items-center gap-3"><Switch checked={s.weekly_report_pdf_logo} onCheckedChange={v => upd("weekly_report_pdf_logo", v)} /><span>Show Logo on PDF</span></div>
        </TabsContent>

        <TabsContent value="notif" className="card-surface p-6 mt-4 space-y-4">
          {[["notif_leave", "Leave Notifications"], ["notif_report", "Weekly Report Notifications"], ["notif_event", "Event Notifications"], ["notif_announcement", "Announcement Notifications"], ["notif_system", "System Notifications"]].map(([k, l]) => (
            <div key={k} className="flex items-center gap-3"><Switch checked={s[k]} onCheckedChange={v => upd(k, v)} data-testid={k} /><span>{l}</span></div>
          ))}
        </TabsContent>

        <TabsContent value="modules" className="card-surface p-6 mt-4 space-y-4">
          {[["mod_leave", "Leave Management"], ["mod_reports", "Weekly Reports"], ["mod_events", "Events"], ["mod_inspections", "Inspection System"], ["mod_rewards", "Rewards & Penalties"], ["mod_announcements", "Announcement Board"], ["mod_id_cards", "Leader ID Cards"], ["mod_qr_attendance", "QR Attendance"], ["mod_notifications", "Notifications"]].map(([k, l]) => (
            <div key={k} className="flex items-center gap-3"><Switch checked={s[k]} onCheckedChange={v => upd(k, v)} data-testid={k} /><span>{l}</span></div>
          ))}
        </TabsContent>

        <TabsContent value="appearance" className="card-surface p-6 mt-4 space-y-4">
          <div><Label>Dashboard Welcome Message</Label><Textarea value={s.dashboard_welcome} onChange={e => upd("dashboard_welcome", e.target.value)} className="bg-[#060F1E] border-white/10" /></div>
          <div className="flex items-center gap-3"><Switch checked={s.show_school_logo} onCheckedChange={v => upd("show_school_logo", v)} /><span>Show School Logo</span></div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
