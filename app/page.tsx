"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, onAuthStateChanged
} from "firebase/auth";
import firebaseConfig from "@/lib/firebase/config";

function getFirebaseAuth() {
  if (typeof window === "undefined") return null;
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getAuth(app);
}

type AuthMode = "google" | "email" | null;

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<AuthMode>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailMode, setEmailMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    setMounted(true);
    const auth = getFirebaseAuth();
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.push("/home");
    });
    return unsub;
  }, [router]);

  async function handleGoogle() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    setLoading("google"); setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push("/home");
    } catch {
      setError("Sign-in failed. Please try again.");
      setLoading(null);
    }
  }

  async function handleEmail() {
    const auth = getFirebaseAuth();
    if (!auth || !email.trim() || !password.trim()) return;
    setLoading("email"); setError("");
    try {
      if (emailMode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.push("/home");
    } catch (e: any) {
      const msg: Record<string, string> = {
        "auth/email-already-in-use": "Email already registered. Try signing in.",
        "auth/invalid-credential": "Wrong email or password.",
        "auth/user-not-found": "No account found. Sign up instead.",
        "auth/wrong-password": "Incorrect password.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/invalid-email": "Invalid email address.",
      };
      setError(msg[e.code] || "Auth failed. Try again.");
      setLoading(null);
    }
  }

  if (!mounted) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Background glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(245,166,35,0.12) 0%, transparent 70%)" }} />
      {/* Grid overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
        backgroundSize: "60px 60px" }} />

      {/* Nav */}
      <nav style={{ position: "relative", zIndex: 10, padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🏏</span>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: "var(--gold)" }}>PACCE</span>
        </div>
        <span className="badge badge-gold">IPL Edition 2025</span>
      </nav>

      {/* Hero */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", position: "relative", zIndex: 10 }}>
        <div style={{ textAlign: "center", maxWidth: 520 }}>
          <div>
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              style={{ fontSize: 80, marginBottom: 24, display: "inline-block" }} className="animate-float">🏏</motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
              style={{ fontSize: "clamp(56px, 12vw, 96px)", fontWeight: 900, lineHeight: 1, marginBottom: 16, letterSpacing: "-0.04em" }}>
              <span style={{ color: "var(--text)" }}>AUCTION</span>
              <br />
              <span className="gradient-gold">11</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
              style={{ fontSize: 22, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 500 }}>
              Bid <span style={{ color: "var(--gold)" }}>·</span> Build <span style={{ color: "var(--gold)" }}>·</span> Win
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }}
              style={{ fontSize: 15, color: "var(--text-dim)", marginBottom: 48 }}>
              Host your private IPL player auction with friends — real-time bidding, live scores, epic squads.
            </motion.p>

            {/* Auth Buttons */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.45 }}
              style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 360, margin: "0 auto" }}>

              {/* Google */}
              <button className="btn btn-lg btn-full" onClick={handleGoogle} disabled={!!loading}
                style={{ background: "#fff", color: "#000", fontSize: 16, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                  borderRadius: 12, padding: "16px 24px", border: "none", cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4)", opacity: loading ? 0.7 : 1 }}>
                {loading === "google" ? (
                  <span style={{ width: 22, height: 22, border: "3px solid #ccc", borderTopColor: "#333", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {loading === "google" ? "Signing in..." : "Continue with Google"}
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ color: "var(--text-dim)", fontSize: 12 }}>OR</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              {/* Email / Password Toggle */}
              <button className="btn btn-lg btn-full btn-outline" onClick={() => setShowEmailForm(!showEmailForm)}
                disabled={!!loading} style={{ fontSize: 15, fontWeight: 600 }}>
                {showEmailForm ? "✕ Hide" : "📧 Sign in with Email"}
              </button>

              {/* Email Form */}
              <AnimatePresence>
                {showEmailForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden", textAlign: "left" }}>
                    {/* Mode toggle */}
                    <div style={{ display: "flex", background: "var(--surface)", borderRadius: 10, padding: 3, marginBottom: 14 }}>
                      {(["signin", "signup"] as const).map(m => (
                        <button key={m} onClick={() => { setEmailMode(m); setError(""); }}
                          style={{ flex: 1, padding: "8px 0", border: "none", cursor: "pointer", borderRadius: 8, fontWeight: 600, fontSize: 13,
                            background: emailMode === m ? "var(--surface-alt)" : "transparent",
                            color: emailMode === m ? "var(--gold)" : "var(--text-muted)" }}>
                          {m === "signin" ? "Sign In" : "Register"}
                        </button>
                      ))}
                    </div>

                    {emailMode === "signup" && (
                      <input className="input" placeholder="Display Name" value={displayName}
                        onChange={e => setDisplayName(e.target.value)} style={{ marginBottom: 10 }} />
                    )}
                    <input className="input" placeholder="Email address" type="email" value={email}
                      onChange={e => setEmail(e.target.value)} style={{ marginBottom: 10 }} />
                    <input className="input" placeholder="Password (min 6 chars)" type="password" value={password}
                      onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmail()}
                      style={{ marginBottom: 14 }} />

                    <button className="btn btn-gold btn-lg btn-full" onClick={handleEmail}
                      disabled={!!loading || !email.trim() || !password.trim()}>
                      {loading === "email" ? (
                        <span style={{ width: 18, height: 18, border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                      ) : emailMode === "signin" ? "Sign In →" : "Create Account →"}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: "var(--danger)", fontSize: 13, textAlign: "center" }}>
                  {error}
                </motion.p>
              )}
            </motion.div>
          </div>
        </div>
      </main>

      {/* Stats bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        style={{ position: "relative", zIndex: 10, padding: "20px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center", gap: "48px", flexWrap: "wrap" }}>
        {[["247", "IPL Players"], ["10", "Teams per Room"], ["Real-time", "Live Bidding"], ["Free", "Always"]].map(([val, label]) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--gold)" }}>{val}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{label}</div>
          </div>
        ))}
      </motion.div>

      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  );
}
