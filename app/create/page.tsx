"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, getDocs, onSnapshot, Timestamp, addDoc } from "firebase/firestore";
import firebaseConfig from "@/lib/firebase/config";
import { Player, PlayerRole } from "@/lib/types";
import { IPL_PLAYERS } from "@/lib/firebase/players";
import { generateRoomCode, formatPurse, getRoleBadgeColor, getRoleLabel, getCountryFlag, shuffleArray } from "@/lib/utils";

function getFirebase() {
  if (typeof window === "undefined") return { auth: null, db: null };
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return { auth: getAuth(app), db: getFirestore(app) };
}

const PURSE_OPTIONS = [{ label: "50 Cr", value: 5000 }, { label: "100 Cr", value: 10000 }, { label: "200 Cr", value: 20000 }];
const SQUAD_OPTIONS = [11, 15, 18, 20];
const TIMER_OPTIONS = [{ label: "10s", value: 10 }, { label: "15s", value: 15 }, { label: "30s", value: 30 }];

const ALL_PLAYERS: Player[] = IPL_PLAYERS.map((p, i) => ({ ...p, id: `player_${i + 1}` }));

export default function CreateRoomPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [purse, setPurse] = useState(10000);
  const [squadSize, setSquadSize] = useState(15);
  const [timer, setTimer] = useState(15);
  const [isPublic, setIsPublic] = useState(true);
  const [roleFilter, setRoleFilter] = useState<PlayerRole | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [participants, setParticipants] = useState<{id:string;name:string}[]>([]);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<"settings" | "players">("settings");

  useEffect(() => {
    const { auth } = getFirebase();
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
    });
    return unsub;
  }, [router]);

  // Generate room code client-side only (avoids SSR hydration mismatch)
  useEffect(() => {
    setRoomCode(generateRoomCode());
  }, []);

  // Select all by default
  useEffect(() => {
    setSelectedIds(new Set(ALL_PLAYERS.map(p => p.id)));
  }, []);

  const filteredPlayers = ALL_PLAYERS.filter(p => {
    const matchRole = roleFilter === "all" || p.role === roleFilter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.country.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  function togglePlayer(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCreate() {
    if (!user || creating) return;
    setCreating(true);
    const { db } = getFirebase();
    if (!db) return;

    const playerQueue = shuffleArray([...selectedIds]);
    const roomRef = doc(db, "rooms", roomCode);
    await setDoc(roomRef, {
      roomCode,
      adminUserId: user.uid,
      status: "lobby",
      purseLakhs: purse,
      squadSize,
      timerSeconds: timer,
      playerOrder: "random",
      isPublic,
      playerQueue,
      selectedPlayerIds: [...selectedIds],
      currentPlayerIdx: 0,
      createdAt: Timestamp.now(),
    });

    // Seed players if not done
    const playersSnap = await getDocs(collection(db, "players"));
    if (playersSnap.empty) {
      for (const p of ALL_PLAYERS) {
        await setDoc(doc(db, "players", p.id), p);
      }
    }

    router.push(`/join/${roomCode}`);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16, background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 40 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/home")}>← Back</button>
        <span style={{ fontWeight: 800, fontSize: 18 }}>Create Auction Room</span>
      </header>

      <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32, alignItems: "start" }}>
          
          {/* Left: Tabs */}
          <div>
            {/* Step tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 28, background: "var(--surface)", borderRadius: 12, padding: 4 }}>
              {[["settings", "⚙️ Settings"], ["players", "🏏 Players"]].map(([s, label]) => (
                <button key={s} onClick={() => setStep(s as "settings" | "players")}
                  style={{ flex: 1, padding: "10px 16px", border: "none", cursor: "pointer", borderRadius: 9, fontSize: 14, fontWeight: 600,
                    background: step === s ? "var(--surface-alt)" : "transparent",
                    color: step === s ? "var(--gold)" : "var(--text-muted)", transition: "all 0.2s" }}>
                  {label}
                </button>
              ))}
            </div>

            {step === "settings" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Purse */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>💰 Starting Purse</h3>
                  <div style={{ display: "flex", gap: 12 }}>
                    {PURSE_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setPurse(o.value)}
                        className="btn" style={{ flex: 1,
                          background: purse === o.value ? "var(--gold)" : "var(--surface-alt)",
                          color: purse === o.value ? "#000" : "var(--text)", fontWeight: 700,
                          border: `1.5px solid ${purse === o.value ? "var(--gold)" : "var(--border-alt)"}` }}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Squad size */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>👥 Squad Size</h3>
                  <div style={{ display: "flex", gap: 12 }}>
                    {SQUAD_OPTIONS.map(s => (
                      <button key={s} onClick={() => setSquadSize(s)}
                        className="btn" style={{ flex: 1,
                          background: squadSize === s ? "var(--gold)" : "var(--surface-alt)",
                          color: squadSize === s ? "#000" : "var(--text)", fontWeight: 700,
                          border: `1.5px solid ${squadSize === s ? "var(--gold)" : "var(--border-alt)"}` }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timer */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>⏱ Bid Timer</h3>
                  <div style={{ display: "flex", gap: 12 }}>
                    {TIMER_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setTimer(o.value)}
                        className="btn" style={{ flex: 1,
                          background: timer === o.value ? "var(--gold)" : "var(--surface-alt)",
                          color: timer === o.value ? "#000" : "var(--text)", fontWeight: 700,
                          border: `1.5px solid ${timer === o.value ? "var(--gold)" : "var(--border-alt)"}` }}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Public toggle */}
                <div className="card" style={{ padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🌐 Public Room</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Allow anyone to discover and join this room</p>
                  </div>
                  <button onClick={() => setIsPublic(!isPublic)}
                    style={{ width: 52, height: 28, borderRadius: 99, border: "none", cursor: "pointer", position: "relative", transition: "all 0.3s",
                      background: isPublic ? "var(--gold)" : "var(--border-alt)" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, transition: "all 0.3s", left: isPublic ? 26 : 3 }} />
                  </button>
                </div>

                <button className="btn btn-gold btn-lg btn-full" onClick={() => setStep("players")}>
                  Next: Select Players →
                </button>
              </motion.div>
            )}

            {step === "players" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Search + filter */}
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <input className="input" placeholder="🔍 Search player..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  {[["all", "All"], ["batsman", "BAT"], ["bowler", "BWL"], ["allrounder", "AR"], ["wk", "WK"]].map(([r, label]) => (
                    <button key={r} onClick={() => setRoleFilter(r as PlayerRole | "all")}
                      className={`btn btn-sm ${roleFilter === r ? "btn-gold" : "btn-ghost"}`}>
                      {label} {r !== "all" && `(${ALL_PLAYERS.filter(p => p.role === r).length})`}
                    </button>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set(ALL_PLAYERS.map(p => p.id)))}>Select All</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>Deselect All</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, maxHeight: "50vh", overflowY: "auto" }}>
                  {filteredPlayers.map(p => {
                    const sel = selectedIds.has(p.id);
                    return (
                      <div key={p.id} onClick={() => togglePlayer(p.id)}
                        style={{ padding: "12px 14px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                          background: sel ? "rgba(245,166,35,0.08)" : "var(--surface)",
                          border: `1.5px solid ${sel ? "var(--gold)" : "var(--border)"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</span>
                          <span style={{ fontSize: 16 }}>{sel ? "✅" : "⬜"}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span className={`badge ${p.role === "wk" ? "badge-purple" : p.role === "batsman" ? "badge-blue" : p.role === "bowler" ? "badge-green" : "badge-gold"}`} style={{ fontSize: 10 }}>
                            {getRoleLabel(p.role)}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{getCountryFlag(p.country)}</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>₹{p.basePriceLakhs}L</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12, textAlign: "center" }}>{selectedIds.size} players selected</p>
              </motion.div>
            )}
          </div>

          {/* Right: Room summary + code */}
          <div style={{ position: "sticky", top: 80 }}>
            <div className="card" style={{ padding: 28, marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>Room Code</h3>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div className="font-mono" style={{ fontSize: 44, fontWeight: 900, letterSpacing: "0.2em", color: "var(--gold)", padding: "16px", background: "var(--surface-alt)", borderRadius: 12, marginBottom: 12 }}>
                  {roomCode}
                </div>
                <button className="btn btn-ghost btn-sm btn-full" onClick={copyCode}>
                  {copied ? "✅ Copied!" : "📋 Copy Code"}
                </button>
              </div>
              <div className="divider" style={{ marginBottom: 20 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Purse</span>
                  <span style={{ fontWeight: 700, color: "var(--gold)" }}>{formatPurse(purse)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Squad Size</span>
                  <span style={{ fontWeight: 700 }}>{squadSize} players</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Timer</span>
                  <span style={{ fontWeight: 700 }}>{timer}s per bid</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Players</span>
                  <span style={{ fontWeight: 700 }}>{selectedIds.size} selected</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Visibility</span>
                  <span className={`badge ${isPublic ? "badge-green" : "badge-gray"}`}>{isPublic ? "Public" : "Private"}</span>
                </div>
              </div>
            </div>

            <button className="btn btn-gold btn-lg btn-full" onClick={handleCreate} disabled={creating || selectedIds.size < 10}>
              {creating ? "Creating..." : "🚀 Create Room"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
