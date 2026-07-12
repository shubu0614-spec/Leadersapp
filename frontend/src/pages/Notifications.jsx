import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export default function Notifications() {
  const [list, setList] = useState([]);
  const load = async () => { const { data } = await api.get("/notifications"); setList(data); };
  useEffect(() => { load(); }, []);

  const markRead = async (id) => { await api.post(`/notifications/${id}/read`); load(); };
  const markAll = async () => { await api.post("/notifications/read-all"); toast.success("All marked read"); load(); };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk" }} data-testid="notifications-title">Notifications</h1><p className="text-slate-400 text-sm mt-1">Your notification history.</p></div>
        <Button variant="outline" onClick={markAll} data-testid="mark-all-read"><CheckCheck className="w-4 h-4 mr-1" /> Mark all read</Button>
      </div>
      <div className="grid gap-3">
        {list.map(n => (
          <div key={n.id} className={`card-surface p-4 flex items-start justify-between ${n.read ? "opacity-60" : ""}`} data-testid={`notif-${n.id}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${n.read ? "bg-white/5" : "bg-sky-500/20"}`}><Bell className={`w-4 h-4 ${n.read ? "text-slate-500" : "text-sky-400"}`} /></div>
              <div>
                <div className="font-semibold">{n.title}</div>
                <div className="text-sm text-slate-400">{n.message}</div>
                <div className="text-xs text-slate-500 mt-1">{n.created_at?.slice(0, 19).replace("T", " ")}</div>
              </div>
            </div>
            {!n.read && <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>Mark read</Button>}
          </div>
        ))}
        {list.length === 0 && <div className="card-surface p-8 text-center text-slate-500">No notifications.</div>}
      </div>
    </div>
  );
}
