"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import html2canvas from "html2canvas";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, collection, onSnapshot, getDocs, query, orderBy } from "firebase/firestore";
import firebaseConfig from "@/lib/firebase/config";
import { Room, Team, Player } from "@/lib/types";
import { IPL_PLAYERS } from "@/lib/firebase/players";
import { formatPurse, formatLakhs, getRoleLabel, getCountryFlag } from "@/lib/utils";

const ALL_PLAYERS: Player[] = IPL_PLAYERS.map((p, i) => ({ ...p, id: `player_${i + 1}` }));

function getFirebase() {
  if (typeof window === "undefined") return { auth: null, db: null };
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return { auth: getAuth(app), db: getFirestore(app) };
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params?.code as string || "").toUpperCase();

  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const downloadSquad = async (teamId: string, teamName: string) => {
    const el = document.getElementById(`team-card-${teamId}`);
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#12121A",
        scale: 2,
        useCORS: true,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${teamName.replace(/\s+/g, '_')}_Squad.png`;
      a.click();
    } catch (err) { console.error("Failed to generate image", err); }
  };

  useEffect(() => {
    const { auth, db } = getFirebase();
    if (!auth || !db) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
      const snap = await getDocs(collection(db, "rooms", code, "teams"));
      const t = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Team[];
      // Sort by squad value desc
      const sorted = t.sort((a, b) => b.playersAcquired.length - a.playersAcquired.length);
      setTeams(sorted);
      const roomSnap = await getDocs(collection(db, "rooms"));
      const roomDoc = roomSnap.docs.find(d => d.id === code);
      if (roomDoc) setRoom({ id: roomDoc.id, ...roomDoc.data(), createdAt: roomDoc.data().createdAt?.toDate() } as Room);
      setLoading(false);
    });
    return unsub;
  }, [router, code]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 48, height: 48, border: "4px solid var(--border)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏏</span>
          <span style={{ fontWeight: 900, color: "var(--gold)" }}>PACCE</span>
        </div>
        <span className="badge badge-gray">Auction Complete</span>
      </header>

      <div className="container" style={{ paddingTop: 48, paddingBottom: 60 }}>
        {/* Trophy animation */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: 48 }}>
          <motion.div
            animate={{ rotate: [-5, 5, -5], y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            style={{ fontSize: 80, display: "inline-block", marginBottom: 16 }}>🏆</motion.div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 8 }}>
            <span className="gradient-gold">Auction Complete!</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 16 }}>Room <span className="font-mono" style={{ color: "var(--gold)" }}>{code}</span> · {teams.length} teams competed</p>
        </motion.div>

        {/* Leaderboard */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ marginBottom: 40 }}>
          <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 20 }}>🏆 Final Standings</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {teams.map((team, i) => {
              const isWinner = i === 0;
              const acquiredPlayers = team.playersAcquired.map(id => ALL_PLAYERS.find(p => p.id === id)).filter(Boolean) as Player[];
              const totalSpent = (room?.purseLakhs || 0) - team.purseRemaining;
              const isOpen = expanded === team.id;

              return (
                <motion.div key={team.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }}>
                  <div
                    id={`team-card-${team.id}`}
                    className={isWinner ? "gold-border" : "card"}
                    style={{ borderRadius: 12, background: isWinner ? "linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(18,18,26,1) 100%)" : "var(--surface)", overflow: "hidden" }}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : team.id)}
                      style={{ width: "100%", padding: "20px 24px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, textAlign: "left" }}>
                      <div style={{ fontSize: 32, flexShrink: 0 }}>{medals[i] || `#${i + 1}`}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          {team.teamName}
                          {isWinner && <span className="badge badge-gold">WINNER</span>}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                          <span>👥 {acquiredPlayers.length} players</span>
                          <span>💰 Purse left: {formatPurse(team.purseRemaining)}</span>
                          <span>📊 Spent: {formatPurse(totalSpent)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 900, fontSize: 22, color: "var(--gold)" }}>{acquiredPlayers.length}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>players</div>
                      </div>
                      <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                    </button>

                    {isOpen && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: "0 24px 20px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ paddingTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                          {acquiredPlayers.map(p => (
                            <div key={p.id} style={{ padding: "10px 12px", background: "var(--surface-alt)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{getCountryFlag(p.country)} {getRoleLabel(p.role)}</div>
                              </div>
                            </div>
                          ))}
                          {acquiredPlayers.length === 0 && (
                            <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-muted)", padding: "16px 0" }}>No players acquired</div>
                          )}
                        </div>
                        {acquiredPlayers.length > 0 && (
                          <div style={{ marginTop: 20, textAlign: "center" }}>
                            <button className="btn btn-outline btn-sm" onClick={() => downloadSquad(team.id, team.teamName)}>
                              📸 Share Squad
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-gold btn-lg" onClick={() => router.push("/create")}>🔄 New Auction</button>
          <button className="btn btn-outline btn-lg" onClick={() => router.push("/home")}>🏠 Back to Home</button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
