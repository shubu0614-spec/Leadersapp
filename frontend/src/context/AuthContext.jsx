import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [error, setError] = useState(null);

  const checkSession = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const login = async (leader_id, pin, remember) => {
    setError(null);
    try {
      const { data } = await api.post("/auth/login", { leader_id, pin });
      localStorage.setItem("slms_token", data.token);
      if (remember) {
        localStorage.setItem("slms_remembered_id", leader_id);
      } else {
        localStorage.removeItem("slms_remembered_id");
      }
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      const msg = formatError(e.response?.data?.detail) || e.message;
      setError(msg);
      return { ok: false, error: msg };
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("slms_token");
    setUser(null);
  };

  const refresh = () => checkSession();

  return (
    <AuthContext.Provider value={{ user, error, login, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
