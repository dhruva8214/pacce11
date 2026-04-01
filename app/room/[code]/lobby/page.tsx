"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, getDoc, collection, onSnapshot, updateDoc, Timestamp, addDoc } from "firebase/firestore";
import firebaseConfig from "@/lib/firebase/config";
import { Room, Team } from "@/lib/types";
import { formatPurse, shuffleArray, generateBotTeam } from "@/lib/utils";

function getFirebase() {
  if (typeof window === "undefined") return { auth: null, db: null };
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return { auth: getAuth(app), db: getFirestore(app) };
}

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params?.code as string || "").toUpperCase();

  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const { auth, db } = getFirebase();
    if (!auth || !db) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    const { db } = getFirebase();
    if (!db) return;
    // Listen to room
    const roomUnsub = onSnapshot(doc(db, "rooms", code), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data(), createdAt: snap.data().createdAt?.toDate() } as Room;
        setRoom(data);
        if (data.status === "auction") router.push(`/room/${code}/auction`);
        if (data.status === "completed") router.push(`/room/${code}/results`);
      }
    });
    // Listen to teams
    const teamsUnsub = onSnapshot(collection(db, "rooms", code, "teams"), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() })) as Team[]);
    });
    return () => { roomUnsub(); teamsUnsub(); };
  }, [code, router]);

  async function startAuction() {
    if (!room || starting || teams.length < 2) return;
    setStarting(true);
    const { db } = getFirebase();
    if (!db) return;
    const playerQueue = shuffleArray([...room.playerQueue]);
    const firstPlayerId = playerQueue[0];
    const timerEnd = new Date(Date.now() + room.timerSeconds * 1000);

    await updateDoc(doc(db, "rooms", code), { status: "auction", playerQueue, currentPlayerIdx: 0 });
    await addDoc(collection(db, "rooms", code, "auctions"), {
      playerId: firstPlayerId,
      currentBidLakhs: 0,
      leadingTeamId: null,
      timerEnd: Timestamp.fromDate(timerEnd),
      status: "bidding",
      bidCount: 0,
      isActive: true,
      createdAt: Timestamp.now(),
    });
    router.push(`/room/${code}/auction`);
  }

  async function fillBots() {
    if (!room || starting) return;
    const { db } = getFirebase();
    if (!db) return;
    
    setStarting(true);
    try {
      const targetTeams = 10;
      const botsToAdd = Math.max(0, targetTeams - teams.length);
      const promises = [];
      for (let i = 0; i < botsToAdd; i++) {
        const botData = generateBotTeam();
        promises.push(addDoc(collection(db, "rooms", code, "teams"), {
          roomId: code,
          userId: `bot_${Date.now()}_${i}`,
          teamName: botData.teamName,
          // We can optionally use ownerName later, but we stick to Team type
          purseRemaining: room.purseLakhs,
          playersAcquired: [],
          withdrawsRemaining: 4,
          isBot: true,
          createdAt: Timestamp.now()
        }));
      }
      await Promise.all(promises);
    } catch (e) {
      console.error(e);
    }
    setStarting(false);
  }

  const isAdmin = user?.uid === room?.adminUserId;

  // AUTO-JOIN BOTS FOR PUBLIC ROOMS
  useEffect(() => {
    if (!isAdmin || !room || !room.isPublic || starting) return;
    if (teams.length >= 10) return;

    // Pick a random time between 2 to 6 seconds for the next bot to join
    const delay = 2000 + Math.random() * 4000;
    
    const timeoutId = setTimeout(async () => {
      const { db } = getFirebase();
      if (!db || starting) return;

      const botData = generateBotTeam();
      try {
        await addDoc(collection(db, "rooms", code, "teams"), {
          roomId: code,
          userId: `bot_${Date.now()}`,
          teamName: botData.teamName,
          purseRemaining: room.purseLakhs,
          playersAcquired: [],
          withdrawsRemaining: 4,
          isBot: true,
          createdAt: Timestamp.now()
        });
      } catch (e) {
        console.error("Auto-join bot failed:", e);
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [isAdmin, room?.isPublic, room?.purseLakhs, starting, teams.length, code]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏏</span>
          <span style={{ fontWeight: 900, color: "var(--gold)" }}>PACCE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Room:</span>
          <span className="font-mono badge badge-gold" style={{ fontSize: 16, letterSpacing: "0.15em" }}>{code}</span>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 600 }}>
          {/* Waiting */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>⏳</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Waiting for the Auction to Start</h1>
            <p style={{ color: "var(--text-muted)" }}>
              {isAdmin ? "Start the auction when everyone has joined." : "Waiting for the admin to start the auction..."}
            </p>
          </motion.div>

          {/* Participants */}
          <div className="card" style={{ padding: 24, marginBottom: 28 }}>
            <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              👥 Participants
              <span className="badge badge-gold">{teams.length} joined</span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <AnimatePresence>
                {teams.map((team, i) => (
                  <motion.div key={team.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "var(--surface-alt)", borderRadius: 10, border: "1px solid var(--border-alt)" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: `hsl(${(i * 60) % 360}, 60%, 40%)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                      {team.teamName[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{team.teamName}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Purse: {formatPurse(team.purseRemaining)}</div>
                    </div>
                    {team.userId === room?.adminUserId && <span className="badge badge-gold">Admin</span>}
                    <span style={{ fontSize: 20 }}>✅</span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {teams.length === 0 && (
                <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                  <div style={{ marginBottom: 8 }}>Share the room code with friends!</div>
                  <div className="font-mono" style={{ fontSize: 36, color: "var(--gold)", letterSpacing: "0.2em" }}>{code}</div>
                </div>
              )}
            </div>
          </div>

          {/* Room info */}
          {room && (
            <div className="card" style={{ padding: 20, marginBottom: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, textAlign: "center", fontSize: 14 }}>
              <div><div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Purse</div><div style={{ fontWeight: 700, color: "var(--gold)" }}>{formatPurse(room.purseLakhs)}</div></div>
              <div><div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Squad</div><div style={{ fontWeight: 700 }}>{room.squadSize} players</div></div>
              <div><div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Timer</div><div style={{ fontWeight: 700 }}>{room.timerSeconds}s</div></div>
            </div>
          )}

          {isAdmin ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button className="btn btn-gold btn-lg btn-full animate-goldGlow" onClick={startAuction}
                disabled={starting || teams.length < 2}
                style={{ fontSize: 18, padding: "18px 24px" }}>
                {starting ? "Starting..." : teams.length < 2 ? `Need at least 2 teams (${teams.length}/2)` : `🚀 Start Auction! (${teams.length} teams)`}
              </button>
              {teams.length < 10 && (
                <button className="btn btn-outline btn-full" onClick={fillBots} disabled={starting}>
                  🤖 Fill Room with Bots (to 10 Teams)
                </button>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
              Waiting for admin to start the auction...
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
