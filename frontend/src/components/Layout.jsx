import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, ClipboardCheck, CalendarOff, FileText, CalendarDays,
  ClipboardList, Award, Megaphone, IdCard, Trophy, Settings as SettingsIcon,
  Bell, User, LogOut, ShieldCheck, Menu, X, Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "leader"] },
  { to: "/leaders", label: "Leaders", icon: Users, roles: ["super_admin", "admin"] },
  { to: "/attendance", label: "Duty Attendance", icon: ClipboardCheck, roles: ["super_admin", "admin", "leader"] },
  { to: "/leaves", label: "Leave Management", icon: CalendarOff, roles: ["super_admin", "admin", "leader"] },
  { to: "/reports", label: "Weekly Reports", icon: FileText, roles: ["super_admin", "admin", "leader"] },
  { to: "/events", label: "Events", icon: CalendarDays, roles: ["super_admin", "admin", "leader"] },
  { to: "/inspections", label: "Inspections", icon: ClipboardList, roles: ["super_admin", "admin"] },
  { to: "/rewards", label: "Rewards & Penalties", icon: Award, roles: ["super_admin", "admin", "leader"] },
  { to: "/rankings", label: "Rankings", icon: Crown, roles: ["super_admin", "admin", "leader"] },
  { to: "/announcements", label: "Announcements", icon: Megaphone, roles: ["super_admin", "admin", "leader"] },
  { to: "/id-cards", label: "Leader ID Cards", icon: IdCard, roles: ["super_admin"] },
  { to: "/certificates", label: "Certificates", icon: Trophy, roles: ["super_admin"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: ["super_admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const items = NAV.filter(n => n.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex" style={{ background: "#060F1E" }}>
      {/* Sidebar */}
      <aside
        className={`${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:sticky top-0 left-0 z-40 w-72 h-screen flex flex-col border-r border-white/5 transition-transform`}
        style={{ background: "#0B1424" }}
        data-testid="sidebar"
      >
        <div className="p-5 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1D4ED8, #38BDF8)" }}>
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-sky-400 font-semibold">Leadership MS</div>
            <div className="text-sm text-slate-300 truncate max-w-[10rem]">{user?.name}</div>
          </div>
          <button className="ml-auto lg:hidden text-slate-400" onClick={() => setOpen(false)} data-testid="close-sidebar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              data-testid={`nav-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-[#1D4ED8]/20 text-white border border-sky-400/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5 space-y-1">
          <NavLink to="/notifications" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5" data-testid="nav-notifications">
            <Bell className="w-4 h-4" /> Notifications
          </NavLink>
          <NavLink to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5" data-testid="nav-profile">
            <User className="w-4 h-4" /> My Profile
          </NavLink>
          <button
            onClick={async () => { await logout(); nav("/login"); }}
            data-testid="logout-button"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 backdrop-blur-xl border-b border-white/5 px-4 lg:px-8 py-4 flex items-center gap-3" style={{ background: "rgba(6, 15, 30, 0.85)" }}>
          <button className="lg:hidden text-slate-300" onClick={() => setOpen(true)} data-testid="open-sidebar">
            <Menu className="w-5 h-5" />
          </button>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
            {user?.role === "super_admin" ? "Super Administrator" : user?.role === "admin" ? "Administrator" : "Leader"}
          </div>
          <div className="ml-auto text-xs text-slate-500 hidden sm:block">
            {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </header>
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
