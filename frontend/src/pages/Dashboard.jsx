import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Users, CheckCircle2, XCircle, CalendarOff, FileText, CalendarDays, Bell, Trophy } from "lucide-react";

function Stat({ icon: Icon, label, value, accent = "sky", testid }) {
  const accents = {
    sky: "text-sky-400 bg-sky-400/10",
    green: "text-emerald-400 bg-emerald-400/10",
    red: "text-red-400 bg-red-400/10",
    amber: "text-amber-400 bg-amber-400/10",
    blue: "text-blue-400 bg-blue-400/10",
    purple: "text-fuchsia-400 bg-fuchsia-400/10",
  };
  return (
    <div className="card-surface p-5 hover:border-sky-400/40 transition-colors" data-testid={testid}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accents[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }}>{value ?? "—"}</div>
      <div className="text-xs uppercase tracking-widest text-slate-500 mt-1">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, e, a] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/events"),
          api.get("/announcements"),
        ]);
        setStats(s.data);
        setEvents(e.data.slice(0, 5));
        setAnnouncements(a.data.slice(0, 5));
      } catch {}
    })();
  }, []);

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-sky-400">Welcome back</div>
        <h1 className="text-3xl lg:text-4xl font-bold mt-1" style={{ fontFamily: "Space Grotesk" }} data-testid="dashboard-title">
          {user?.name}
        </h1>
        <p className="text-slate-400 text-sm mt-1">{user?.position || "Leader"} · {user?.leader_id}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {isAdmin && <Stat icon={Users} label="Total Leaders" value={stats.total_leaders} accent="blue" testid="stat-total-leaders" />}
        <Stat icon={CheckCircle2} label="Present Today" value={stats.present_leaders} accent="green" testid="stat-present" />
        <Stat icon={XCircle} label="Absent Today" value={stats.absent_leaders} accent="red" testid="stat-absent" />
        <Stat icon={CalendarOff} label="On Leave" value={stats.on_leave} accent="amber" testid="stat-on-leave" />
        {isAdmin && <Stat icon={FileText} label="Pending Leaves" value={stats.pending_leaves} accent="purple" testid="stat-pending-leaves" />}
        <Stat icon={CalendarDays} label="Upcoming Events" value={stats.upcoming_events} accent="sky" testid="stat-events" />
        <Stat icon={Bell} label="Unread Notifs" value={stats.unread_notifications} accent="amber" testid="stat-notifications" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm uppercase tracking-widest text-slate-300">Upcoming Events</h3>
          </div>
          {events.length === 0 && <div className="text-sm text-slate-500">No events scheduled.</div>}
          <ul className="space-y-3" data-testid="dashboard-events">
            {events.map(e => (
              <li key={e.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-slate-500">{e.venue}</div>
                </div>
                <div className="text-xs text-sky-400 text-right">
                  <div>{e.date}</div>
                  <div>{e.time}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm uppercase tracking-widest text-slate-300">Latest Announcements</h3>
          </div>
          {announcements.length === 0 && <div className="text-sm text-slate-500">No announcements yet.</div>}
          <ul className="space-y-3" data-testid="dashboard-announcements">
            {announcements.map(a => (
              <li key={a.id} className="border-b border-white/5 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${a.priority === "urgent" ? "bg-red-400" : a.priority === "important" ? "bg-amber-400" : "bg-sky-400"}`} />
                  <div className="font-medium">{a.title}</div>
                </div>
                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{a.message}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
