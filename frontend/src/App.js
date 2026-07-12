import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Leaders from "@/pages/Leaders";
import Attendance from "@/pages/Attendance";
import Leaves from "@/pages/Leaves";
import Reports from "@/pages/Reports";
import Events from "@/pages/Events";
import Inspections from "@/pages/Inspections";
import Rewards from "@/pages/Rewards";
import Announcements from "@/pages/Announcements";
import IDCards from "@/pages/IDCards";
import Certificates from "@/pages/Certificates";
import Settings from "@/pages/Settings";
import Notifications from "@/pages/Notifications";
import Profile from "@/pages/Profile";
import Rankings from "@/pages/Rankings";

function Protected({ children, roles }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-300" data-testid="loading-screen">
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="leaders" element={<Protected roles={["super_admin", "admin"]}><Leaders /></Protected>} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="reports" element={<Reports />} />
        <Route path="events" element={<Events />} />
        <Route path="inspections" element={<Protected roles={["super_admin", "admin"]}><Inspections /></Protected>} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="rankings" element={<Rankings />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="id-cards" element={<Protected roles={["super_admin"]}><IDCards /></Protected>} />
        <Route path="certificates" element={<Protected roles={["super_admin"]}><Certificates /></Protected>} />
        <Route path="settings" element={<Protected roles={["super_admin"]}><Settings /></Protected>} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster theme="dark" position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
