"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { getFirestore, collection, query, where, orderBy, getDocs, doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import firebaseConfig from "@/lib/firebase/config";
import { Room } from "@/lib/types";
import { generateRoomCode, formatPurse, shuffleArray } from "@/lib/utils";
import { IPL_PLAYERS } from "@/lib/firebase/players";

const ALL_PLAYERS = IPL_PLAYERS.map((p, i) => ({ ...p, id: `player_${i + 1}` }));

function getFirebase() {
  if (typeof window === "undefined") return { auth: null, db: null };
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return { auth: getAuth(app), db: getFirestore(app) };
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [activeRooms, setActiveRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [tab, setTab] = useState<"public" | "active">("public");

  useEffect(() => {
    const { auth, db } = getFirebase();
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
      if (db) {
        try {
          // Public rooms
          const pubQ = query(collection(db, "rooms"), where("isPublic", "==", true), orderBy("createdAt", "desc"));
          const pubSnap = await getDocs(pubQ);
          let fetchedPublicRooms = pubSnap.docs
            .map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() }) as Room)
            .filter(r => r.status !== "completed").slice(0, 12);
            
          // Inject mock bot rooms to create perceived activity
          if (fetchedPublicRooms.length < 6) {
            const mocksNeeded = 6 - fetchedPublicRooms.length;
            const mockRooms: Room[] = Array.from({length: mocksNeeded}).map((_, i) => {
              const char = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
              const code = `PUB${char}${Math.floor(Math.random()*900) + 100}`;
              return {
                id: code,
                roomCode: code,
                adminUserId: 'SYSTEM',
                status: 'lobby',
                purseLakhs: [5000, 10000, 20000][Math.floor(Math.random()*3)],
                squadSize: [11, 15, 18][Math.floor(Math.random()*3)],
                timerSeconds: [10, 15, 30][Math.floor(Math.random()*3)],
                isPublic: true,
                createdAt: new Date(),
                playerQueue: [],
                selectedPlayerIds: [],
                currentPlayerIdx: 0,
                playerOrder: "random"
              };
            });
            fetchedPublicRooms = [...fetchedPublicRooms, ...mockRooms];
          }
          setPublicRooms(fetchedPublicRooms);
        } catch { /* index not yet created */ }

        try {
          // All rooms — find those the user has a team in (checking subcollection)
          const allRoomsSnap = await getDocs(query(collection(db, "rooms"), where("status", "in", ["lobby", "auction"]), orderBy("createdAt", "desc")));
          const userRooms: Room[] = [];
          for (const roomDoc of allRoomsSnap.docs.slice(0, 20)) {
            const teamsSnap = await getDocs(query(collection(db, "rooms", roomDoc.id, "teams"), where("userId", "==", u.uid)));
            if (!teamsSnap.empty || roomDoc.data().adminUserId === u.uid) {
              userRooms.push({ id: roomDoc.id, ...roomDoc.data(), createdAt: roomDoc.data().createdAt?.toDate() } as Room);
            }
          }
          setActiveRooms(userRooms);
        } catch { /* ignore */ }
      }
      setLoading(false);
    });
    return unsub;
  }, [router]);

  async function handleCreateRoom() { router.push("/create"); }
  async function handleJoinRoom() {
    if (joinCode.trim().length === 6) router.push(`/join/${joinCode.trim().toUpperCase()}`);
  }
  
  const [joiningRoomCode, setJoiningRoomCode] = useState("");
  async function handleJoinPublicRoom(room: Room) {
    if (room.adminUserId === 'SYSTEM') {
      const { db } = getFirebase();
      if (!db) return;
      setJoiningRoomCode(room.roomCode); // Show immediate loading state if needed
      try {
        const roomRef = doc(db, "rooms", room.roomCode);
        const snap = await getDoc(roomRef);
        if (!snap.exists()) {
          const playerIds = ALL_PLAYERS.map(p => p.id);
          const playerQueue = shuffleArray([...playerIds]);
          
          await setDoc(roomRef, {
            roomCode: room.roomCode,
            adminUserId: 'SYSTEM',
            status: "lobby",
            purseLakhs: room.purseLakhs,
            squadSize: room.squadSize,
            timerSeconds: room.timerSeconds,
            playerOrder: "random",
            isPublic: true,
            playerQueue,
            selectedPlayerIds: playerIds,
            currentPlayerIdx: 0,
            createdAt: Timestamp.now(),
          });
          
          const playersSnap = await getDocs(collection(db, "players"));
          if (playersSnap.empty) {
            for (const p of ALL_PLAYERS) {
              await setDoc(doc(db, "players", p.id), p);
            }
          }
        }
      } catch (err) {
        console.error("Failed to materialize mock room:", err);
      } finally {
        setJoiningRoomCode("");
      }
    }
    router.push(`/join/${room.roomCode}`);
  }
  async function handleSignOut() {
    const { auth } = getFirebase();
    if (auth) { await signOut(auth); router.push("/"); }
  }

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Guest";
  const avatar = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=F5A623&color=000&bold=true`;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ width: 48, height: 48, border: "4px solid var(--border)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p>Loading your dashboard...</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 40, background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🏏</span>
          <span style={{ fontWeight: 900, fontSize: 20, color: "var(--gold)", letterSpacing: "-0.02em" }}>PACCE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={avatar} alt={displayName} style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid var(--border-alt)" }} />
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{displayName}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        {/* Hero CTAs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.02em" }}>
            Welcome back, <span className="gradient-gold">{displayName.split(" ")[0]}</span> 👋
          </h1>
          <p style={{ color: "var(--text-muted)", marginBottom: 32 }}>Ready to host or join an auction?</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {/* Create Room */}
            <motion.div whileHover={{ scale: 1.02 }} className="card" style={{ padding: 28, cursor: "pointer", background: "linear-gradient(135deg, rgba(245,166,35,0.08) 0%, rgba(245,166,35,0.02) 100%)", border: "1px solid rgba(245,166,35,0.2)" }} onClick={handleCreateRoom}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🏟️</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Create Room</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>Set up your auction, invite friends with a 6-char code, pick players.</p>
              <button className="btn btn-gold btn-full">Create Auction Room →</button>
            </motion.div>

            {/* Join Room */}
            <motion.div whileHover={{ scale: 1.02 }} className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🎟️</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Join Room</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>Have a 6-character room code? Jump right into the auction.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="input input-mono" placeholder="ROOM CODE"
                  value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={e => e.key === "Enter" && handleJoinRoom()}
                  style={{ flex: 1, fontSize: 18, letterSpacing: "0.15em", textAlign: "center" }}
                />
                <button className="btn btn-outline" onClick={handleJoinRoom} disabled={joinCode.length !== 6}>Join</button>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Room tabs */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
            {[["public", "🌐 Public Rooms"], ["active", "⚡ Active Rooms"]].map(([t, label]) => (
              <button key={t} onClick={() => setTab(t as "public" | "active")}
                style={{ padding: "10px 20px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
                  color: tab === t ? "var(--gold)" : "var(--text-muted)",
                  borderBottom: tab === t ? "2px solid var(--gold)" : "2px solid transparent",
                  marginBottom: -1, transition: "all 0.2s" }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "public" && (
            <div>
              {publicRooms.length === 0 ? (
                <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                  <p style={{ fontSize: 16 }}>No public rooms at the moment.</p>
                  <p style={{ fontSize: 13, marginTop: 8 }}>Create one and let strangers join the fun!</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {publicRooms.map((room, i) => (
                    <motion.div key={room.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      className="card" style={{ padding: 20, cursor: "pointer" }}
                      onClick={() => handleJoinPublicRoom(room)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <span className="font-mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.1em", color: "var(--gold)" }}>{room.roomCode}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {room.status === "auction" && <span className="pulse-dot" />}
                          <span className={`badge ${room.status === "auction" ? "badge-green" : "badge-gold"}`}>{room.status}</span>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
                        <div>💰 Purse: <span style={{ color: "var(--text)", fontWeight: 600 }}>{formatPurse(room.purseLakhs)}</span></div>
                        <div>👥 Size: <span style={{ color: "var(--text)", fontWeight: 600 }}>{room.squadSize} players</span></div>
                        <div>⏱ Timer: <span style={{ color: "var(--text)", fontWeight: 600 }}>{room.timerSeconds}s</span></div>
                      </div>
                      <button className="btn btn-outline btn-sm btn-full" style={{ marginTop: 16 }} disabled={joiningRoomCode === room.roomCode}>
                        {joiningRoomCode === room.roomCode ? "Loading..." : "Join Room →"}
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "active" && (
            <div>
              {activeRooms.length === 0 ? (
                <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
                  <p>No active rooms found.</p>
                  <p style={{ fontSize: 13, marginTop: 8 }}>Create a room or join one with a code!</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {activeRooms.map((room, i) => {
                    const dest = room.status === "auction" ? `/room/${room.roomCode}/auction`
                      : room.status === "completed" ? `/room/${room.roomCode}/results`
                      : `/room/${room.roomCode}/lobby`;
                    return (
                      <motion.div key={room.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="card" style={{ padding: 20, cursor: "pointer", border: room.status === "auction" ? "1px solid rgba(34,197,94,0.3)" : undefined }}
                        onClick={() => router.push(dest)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <span className="font-mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.1em", color: "var(--gold)" }}>{room.roomCode}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {room.status === "auction" && <span className="pulse-dot" />}
                            <span className={`badge ${room.status === "auction" ? "badge-green" : room.status === "lobby" ? "badge-gold" : "badge-gray"}`}>{room.status}</span>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
                          <div>💰 Purse: <span style={{ color: "var(--text)", fontWeight: 600 }}>{formatPurse(room.purseLakhs)}</span></div>
                          <div>👥 Size: <span style={{ color: "var(--text)", fontWeight: 600 }}>{room.squadSize} players</span></div>
                        </div>
                        <button className={`btn btn-sm btn-full ${room.status === "auction" ? "btn-gold" : "btn-outline"}`} style={{ marginTop: 16 }}>
                          {room.status === "auction" ? "🔴 Rejoin Live" : room.status === "lobby" ? "Enter Lobby →" : "View Results →"}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
