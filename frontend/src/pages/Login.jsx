import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, User2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [leaderId, setLeaderId] = useState(localStorage.getItem("slms_remembered_id") || "");
  const [pin, setPin] = useState("");
  const [remember, setRemember] = useState(!!localStorage.getItem("slms_remembered_id"));
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!leaderId.trim() || pin.length !== 4) {
      toast.error("Enter Leader ID and 4-digit PIN");
      return;
    }
    setLoading(true);
    const r = await login(leaderId.trim(), pin, remember);
    setLoading(false);
    if (!r.ok) toast.error(r.error || "Login failed");
    else toast.success("Welcome back");
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4" style={{ background: "#060F1E" }}>
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(30,58,138,0.35) 0%, transparent 70%)" }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1D4ED8, #38BDF8)" }}>
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-sky-400 font-semibold">Enterprise Portal</div>
            <div className="text-xl font-bold" style={{ fontFamily: "Space Grotesk" }}>Leadership MS</div>
          </div>
        </div>

        <div className="card-surface p-8 backdrop-blur-xl" style={{ background: "rgba(15, 26, 46, 0.85)" }}>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "Space Grotesk" }}>Sign in</h1>
          <p className="text-slate-400 text-sm mb-6">Enter your Leader ID and 4-digit PIN.</p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label htmlFor="leader-id" className="text-slate-300 text-xs uppercase tracking-widest">Leader ID</Label>
              <div className="relative mt-2">
                <User2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="leader-id"
                  data-testid="login-leader-id-input"
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                  placeholder="e.g. L-001 or admin"
                  className="pl-10 bg-[#060F1E] border-white/10 text-white h-11"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="pin" className="text-slate-300 text-xs uppercase tracking-widest">4-Digit PIN</Label>
              <div className="relative mt-2">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="pin"
                  data-testid="login-pin-input"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="pl-10 bg-[#060F1E] border-white/10 text-white h-11 tracking-[0.5em] text-lg"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-sky-400"
                  data-testid="toggle-pin-visibility"
                >
                  {showPin ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <Checkbox
                  data-testid="login-remember-checkbox"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(!!v)}
                />
                Remember this device
              </label>
              <button type="button" className="text-sky-400 hover:text-sky-300 text-xs" data-testid="forgot-pin-link">
                Forgot PIN?
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="w-full h-11 btn-primary rounded-lg font-semibold"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-xs text-slate-500 text-center">
            PINs are hashed and never stored on this device.
          </p>
        </div>
      </div>
    </div>
  );
}
