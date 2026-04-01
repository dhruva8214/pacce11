"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  getFirestore, doc, onSnapshot, collection, query, where,
  getDocs, updateDoc, addDoc, Timestamp, runTransaction, orderBy, limit, deleteDoc
} from "firebase/firestore";
import firebaseConfig from "@/lib/firebase/config";
import { Room, Team, Player, CurrentAuction, BidEntry } from "@/lib/types";
import { useAuctionStore } from "@/lib/stores/auctionStore";
import { useCountdownTimer } from "@/lib/hooks/useCountdownTimer";
import { useEmojiReactions } from "@/lib/hooks/useEmojiReactions";
import { formatLakhs, formatPurse, getRoleLabel, getRoleBadgeColor, getCountryFlag, getPurseColor } from "@/lib/utils";
import { IPL_PLAYERS } from "@/lib/firebase/players";

const ALL_PLAYERS: Player[] = IPL_PLAYERS.map((p, i) => ({ ...p, id: `player_${i + 1}` }));

function getFirebase() {
  if (typeof window === "undefined") return { auth: null, db: null };
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return { auth: getAuth(app), db: getFirestore(app) };
}

// ── Countdown Timer Arc ──────────────────────────────────────────────────────
function TimerArc({ timerEnd, totalSeconds }: { timerEnd: Date | null; totalSeconds: number }) {
  const { timeLeft, percentage, isCritical } = useCountdownTimer(timerEnd);
  const R = 48; const C = 2 * Math.PI * R;
  const dash = (percentage / 100) * C;

  return (
    <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
      <svg width="120" height="120" viewBox="0 0 120 120" className="timer-arc">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle cx="60" cy="60" r={R} fill="none"
          stroke={isCritical ? "var(--danger)" : percentage > 50 ? "var(--success)" : "var(--gold)"}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          style={{ transition: "stroke-dasharray 0.1s linear, stroke 0.5s" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: isCritical ? "var(--danger)" : "var(--text)",
          ...(isCritical ? { animation: "countdownPulse 0.5s ease-in-out infinite" } : {}) }}>
          {timeLeft}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>SEC</span>
      </div>
    </div>
  );
}

// ── Player Card ──────────────────────────────────────────────────────────────
function PlayerCard({ player }: { player: Player }) {
  const roleColors: Record<string, string> = { wk: "var(--purple)", batsman: "var(--info)", bowler: "var(--success)", allrounder: "var(--gold)" };
  return (
    <div className="card" style={{ padding: 28, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: `radial-gradient(circle, ${roleColors[player.role]}22 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Avatar */}
        <div style={{ width: 90, height: 90, borderRadius: 16, background: `linear-gradient(135deg, ${roleColors[player.role]}33 0%, var(--surface-alt) 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, flexShrink: 0, border: `2px solid ${roleColors[player.role]}44` }}>
          🏏
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", background: roleColors[player.role], color: player.role === "allrounder" ? "#000" : "#fff" }}>
              {getRoleLabel(player.role)}
            </span>
            {player.isCapped && <span className="badge badge-gold">CAPPED</span>}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{player.name}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 16 }}>
            {getCountryFlag(player.country)} {player.country} · {player.previousTeam || "Uncapped"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
            <div style={{ color: "var(--text-muted)" }}>🏏 {player.battingStyle}</div>
            <div style={{ color: "var(--text-muted)" }}>⚾ {player.bowlingStyle}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 20, padding: "12px 16px", background: "var(--surface-alt)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Base Price</span>
        <span style={{ fontWeight: 800, fontSize: 18, color: "var(--gold)" }}>{formatLakhs(player.basePriceLakhs)}</span>
      </div>
    </div>
  );
}

// ── Teams Sidebar ─────────────────────────────────────────────────────────────
function TeamsSidebar({ teams, myTeam, totalPurse, room }: { teams: Team[]; myTeam: Team | null; totalPurse: number; room: Room }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="card" style={{ padding: 20, height: "100%", overflowY: "auto" }}>
      <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>🏟️ Teams ({teams.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {teams.map((team, i) => {
          const purseColor = getPurseColor(team.purseRemaining, totalPurse);
          const isMe = team.id === myTeam?.id;
          const isOpen = expanded === team.id;
          const acquiredPlayers = team.playersAcquired.map(id => ALL_PLAYERS.find(p => p.id === id)).filter(Boolean) as Player[];
          return (
            <div key={team.id} style={{ borderRadius: 10, overflow: "hidden", border: isMe ? "1.5px solid var(--gold)" : "1px solid var(--border)" }}>
              <button onClick={() => setExpanded(isOpen ? null : team.id)}
                style={{ width: "100%", padding: "12px 14px", background: isMe ? "rgba(245,166,35,0.07)" : "var(--surface-alt)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: `hsl(${i * 60 % 360},60%,40%)`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#fff", flexShrink: 0 }}>
                  {team.teamName[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    {team.teamName} {isMe && <span style={{ fontSize: 10, color: "var(--gold)" }}>(You)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: purseColor, fontWeight: 600 }}>{formatPurse(team.purseRemaining)} left · {team.playersAcquired.length}/{room.squadSize}</div>
                </div>
                <div style={{ width: 40, height: 5, background: "var(--border)", borderRadius: 99, flexShrink: 0 }}>
                  <div style={{ height: "100%", width: `${(team.purseRemaining / totalPurse) * 100}%`, background: purseColor, borderRadius: 99, transition: "width 0.5s" }} />
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} style={{ overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                      {acquiredPlayers.length === 0 ? (
                        <p style={{ fontSize: 12, color: "var(--text-dim)", textAlign: "center", padding: "8px 0" }}>No players yet</p>
                      ) : (
                        acquiredPlayers.map(p => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                            <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                            <span style={{ color: "var(--text-muted)" }}>{getRoleLabel(p.role)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SOLD / UNSOLD Overlay ─────────────────────────────────────────────────────
function SoldOverlay({ data }: { data: { player: Player; team: Team; price: number } | null }) {
  return (
    <AnimatePresence>
      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overlay-backdrop">
          <motion.div initial={{ scale: 0.7, y: 60 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }}
            style={{ textAlign: "center", padding: "48px 64px", borderRadius: 24, background: "linear-gradient(135deg, rgba(245,166,35,0.15) 0%, rgba(18,18,26,0.95) 100%)", border: "2px solid var(--gold)", boxShadow: "0 0 80px rgba(245,166,35,0.4)" }}>
            <div style={{ fontSize: 80, marginBottom: 16, animation: "float 1s ease-in-out infinite" }}>🔨</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: "var(--gold)", letterSpacing: "-0.04em", textTransform: "uppercase", marginBottom: 8 }}>SOLD!</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{data.player.name}</div>
            <div style={{ fontSize: 16, color: "var(--text-muted)", marginBottom: 20 }}>to <span style={{ color: "var(--gold)", fontWeight: 700 }}>{data.team.teamName}</span></div>
            <div style={{ fontSize: 40, fontWeight: 900, color: "var(--success)" }}>{formatLakhs(data.price)}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function UnsoldOverlay({ data }: { data: { player: Player } | null }) {
  return (
    <AnimatePresence>
      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overlay-backdrop">
          <motion.div initial={{ scale: 0.7, y: 60 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }}
            style={{ textAlign: "center", padding: "48px 64px", borderRadius: 24, background: "rgba(18,18,26,0.95)", border: "1px solid var(--border-alt)" }}>
            <div style={{ fontSize: 80, marginBottom: 16 }}>😞</div>
            <div style={{ fontSize: 64, fontWeight: 900, color: "var(--text-muted)", letterSpacing: "-0.04em", textTransform: "uppercase", marginBottom: 8 }}>UNSOLD</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-muted)" }}>{data.player.name}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main Auction Screen ───────────────────────────────────────────────────────
export default function AuctionPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params?.code as string || "").toUpperCase();

  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [currentAuction, setCurrentAuction] = useState<any | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [bidFeed, setBidFeed] = useState<BidEntry[]>([]);
  const [soldOverlay, setSoldOverlay] = useState<{ player: Player; team: Team; price: number } | null>(null);
  const [unsoldOverlay, setUnsoldOverlay] = useState<{ player: Player } | null>(null);
  const [bidding, setBidding] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { emojiReactions, sendReaction, EMOJIS } = useEmojiReactions();

  const timerEnd = currentAuction?.timerEnd?.toDate ? currentAuction.timerEnd.toDate() : null;
  const { timeLeft, isCritical, isExpired } = useCountdownTimer(timerEnd);

  // Auth
  useEffect(() => {
    const { auth } = getFirebase();
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);
    });
    return unsub;
  }, [router]);

  // Room + Teams + Auction listeners
  useEffect(() => {
    const { db } = getFirebase();
    if (!db || !user) return;

    const roomUnsub = onSnapshot(doc(db, "rooms", code), (snap) => {
      if (snap.exists()) setRoom({ id: snap.id, ...snap.data(), createdAt: snap.data().createdAt?.toDate() } as Room);
    });

    const teamsUnsub = onSnapshot(collection(db, "rooms", code, "teams"), (snap) => {
      const t = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Team[];
      setTeams(t);
      const mine = t.find(tm => tm.userId === user.uid) || null;
      setMyTeam(mine);
    });

    const auctionQ = query(collection(db, "rooms", code, "auctions"), where("isActive", "==", true), limit(1));
    const auctionUnsub = onSnapshot(auctionQ, (snap) => {
      if (!snap.empty) {
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        setCurrentAuction(data);
        const player = ALL_PLAYERS.find(p => p.id === data.playerId) || null;
        setCurrentPlayer(player);
      }
    });

    const bidQ = query(collection(db, "rooms", code, "bidHistory"), orderBy("placedAt", "desc"), limit(10));
    const bidUnsub = onSnapshot(bidQ, (snap) => {
      const feeds = snap.docs.map(d => ({
        id: d.id, ...d.data(), placedAt: d.data().placedAt?.toDate()
      })) as BidEntry[];
      setBidFeed(feeds);
    });

    return () => { roomUnsub(); teamsUnsub(); auctionUnsub(); bidUnsub(); };
  }, [code, user]);

  const isAdmin = user?.uid === room?.adminUserId;

  // 🤖 BOT AI HOOK
  useEffect(() => {
    if (!isAdmin || !currentAuction || !currentAuction.isActive || !currentPlayer || bidding || !room) return;
    
    const botTeams = teams.filter(t => t.isBot);
    // If there are no bots or player is somehow missing, do nothing
    if (botTeams.length === 0) return;

    // Check if humans are bidding too fast - wait a cycle
    // Bot needs to know how much to bid next
    const increment = currentAuction.currentBidLakhs === 0 ? currentPlayer.basePriceLakhs : 25;
    const nextBidAmount = currentAuction.currentBidLakhs === 0 ? currentPlayer.basePriceLakhs : currentAuction.currentBidLakhs + increment;

    const eligibleBots = botTeams.filter(bot => {
      if (bot.id === currentAuction.leadingTeamId) return false;
      if (bot.purseRemaining < nextBidAmount) return false;
      if (bot.playersAcquired.length >= room.squadSize) return false;

      // Evaluation Logic
      let maxWilling = currentPlayer.basePriceLakhs * (currentPlayer.isCapped ? 3.0 : 1.5);
      
      const botPlayers = bot.playersAcquired.map(id => ALL_PLAYERS.find(p => p.id === id)).filter(Boolean) as Player[];
      const roleCount = botPlayers.filter(p => p.role === currentPlayer.role).length;
      
      if (roleCount === 0) maxWilling *= 1.8; // Desperate for this role
      if (roleCount >= 3) maxWilling *= 0.5;  // Already have plenty

      // Add a slight randomization to make them feel unique
      const randomFactor = 0.8 + Math.random() * 0.4; // 0.8x to 1.2x

      return nextBidAmount <= (maxWilling * randomFactor);
    });

    if (eligibleBots.length === 0) return;

    const biddingBot = eligibleBots[Math.floor(Math.random() * eligibleBots.length)];
    const reactionTime = 1000 + (Math.random() * 2500); // 1.0s to 3.5s delay

    const timeout = setTimeout(async () => {
      if (bidding) return;
      const { db } = getFirebase();
      if (!db) return;
      
      try {
        const newTimerEnd = new Date(Date.now() + room.timerSeconds * 1000);
        await updateDoc(doc(db, "rooms", code, "auctions", currentAuction.id), {
          currentBidLakhs: nextBidAmount,
          leadingTeamId: biddingBot.id,
          timerEnd: Timestamp.fromDate(newTimerEnd),
          bidCount: (currentAuction.bidCount || 0) + 1,
        });
        await addDoc(collection(db, "rooms", code, "bidHistory"), {
          teamId: biddingBot.id,
          teamName: biddingBot.teamName,
          playerId: currentAuction.playerId,
          amountLakhs: nextBidAmount,
          placedAt: Timestamp.now()
        });
      } catch (e) {
        console.error("Bot Bidding Error:", e);
      }
    }, reactionTime);

    return () => clearTimeout(timeout);
  }, [currentAuction?.currentBidLakhs, currentAuction?.isActive, isAdmin, bidding, room, currentPlayer, code, teams]);

  async function placeBid(increment: number) {
    if (!currentAuction || !myTeam || bidding) return;
    const newBid = Math.max(currentAuction.currentBidLakhs + increment, currentPlayer?.basePriceLakhs || increment);
    if (newBid > myTeam.purseRemaining) return;
    if (myTeam.id === currentAuction.leadingTeamId) return;
    setBidding(true);
    const { db } = getFirebase();
    if (!db) return;
    try {
      const newTimerEnd = new Date(Date.now() + (room?.timerSeconds || 15) * 1000);
      await updateDoc(doc(db, "rooms", code, "auctions", currentAuction.id), {
        currentBidLakhs: newBid,
        leadingTeamId: myTeam.id,
        timerEnd: Timestamp.fromDate(newTimerEnd),
        bidCount: (currentAuction.bidCount || 0) + 1,
      });
      await addDoc(collection(db, "rooms", code, "bidHistory"), {
        teamId: myTeam.id,
        teamName: myTeam.teamName,
        playerId: currentAuction.playerId,
        amountLakhs: newBid,
        placedAt: Timestamp.now()
      });
    } catch (e) {
      console.error(e);
    }
    setBidding(false);
  }

  async function withdrawBid() {
    if (!currentAuction || !myTeam || bidding || !isLeading) return;
    if (myTeam.withdrawsRemaining <= 0) return;
    
    setBidding(true);
    const { db } = getFirebase();
    if (!db) return;
    
    try {
      const q = query(
        collection(db, "rooms", code, "bidHistory"),
        where("playerId", "==", currentAuction.playerId),
        orderBy("placedAt", "desc"),
        limit(2)
      );
      const snap = await getDocs(q);
      
      if (snap.empty || snap.docs[0].data().teamId !== myTeam.id) {
        setBidding(false);
        return;
      }

      const topBidDoc = snap.docs[0];
      const prevBidDoc = snap.docs.length > 1 ? snap.docs[1] : null;

      await deleteDoc(topBidDoc.ref);

      const prevAmount = prevBidDoc ? prevBidDoc.data().amountLakhs : 0;
      const prevTeam = prevBidDoc ? prevBidDoc.data().teamId : null;
      
      const newTimerEnd = new Date(Date.now() + (room?.timerSeconds || 15) * 1000);
      
      await updateDoc(doc(db, "rooms", code, "auctions", currentAuction.id), {
        currentBidLakhs: prevAmount,
        leadingTeamId: prevTeam,
        timerEnd: Timestamp.fromDate(newTimerEnd),
        bidCount: Math.max(0, (currentAuction.bidCount || 1) - 1),
      });

      await updateDoc(doc(db, "rooms", code, "teams", myTeam.id), {
        withdrawsRemaining: Math.max(0, myTeam.withdrawsRemaining - 1)
      });

      // Simple local slice to visually reflect immediate withdrawal
      setBidFeed(prev => prev.slice(1));
    } catch (e) { console.error("Withdraw failed:", e); }
    setBidding(false);
  }

  async function advancePlayer(outcome: "sold" | "unsold") {
    if (!currentAuction || !room) return;
    const { db } = getFirebase();
    if (!db) return;

    if (outcome === "sold" && currentAuction.leadingTeamId) {
      const winTeam = teams.find(t => t.id === currentAuction.leadingTeamId);
      if (winTeam && currentPlayer) {
        setSoldOverlay({ player: currentPlayer, team: winTeam, price: currentAuction.currentBidLakhs });
        await updateDoc(doc(db, "rooms", code, "teams", winTeam.id), {
          purseRemaining: winTeam.purseRemaining - currentAuction.currentBidLakhs,
          playersAcquired: [...winTeam.playersAcquired, currentPlayer.id],
        });
        setTimeout(() => setSoldOverlay(null), 3000);
      }
    } else if (currentPlayer) {
      setUnsoldOverlay({ player: currentPlayer });
      setTimeout(() => setUnsoldOverlay(null), 2500);
    }

    await updateDoc(doc(db, "rooms", code, "auctions", currentAuction.id), { isActive: false, status: outcome });
    const nextIdx = (room.currentPlayerIdx || 0) + 1;
    if (nextIdx >= room.playerQueue.length) {
      await updateDoc(doc(db, "rooms", code), { status: "completed" });
      setTimeout(() => router.push(`/room/${code}/results`), 3500);
      return;
    }
    await updateDoc(doc(db, "rooms", code), { currentPlayerIdx: nextIdx });
    const nextPlayer = room.playerQueue[nextIdx];
    const newTimerEnd = new Date(Date.now() + room.timerSeconds * 1000);
    await addDoc(collection(db, "rooms", code, "auctions"), {
      playerId: nextPlayer, currentBidLakhs: 0, leadingTeamId: null,
      timerEnd: Timestamp.fromDate(newTimerEnd), status: "bidding", bidCount: 0, isActive: true, createdAt: Timestamp.now(),
    });
  }

  // Auto-advance when timer expires
  useEffect(() => {
    if (isExpired && currentAuction && user?.uid === room?.adminUserId) {
      const t = setTimeout(() => {
        const outcome = currentAuction.leadingTeamId ? "sold" : "unsold";
        advancePlayer(outcome);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [isExpired, currentAuction?.id]);

  // (Removed redeclaration of isAdmin)
  const isLeading = myTeam && currentAuction?.leadingTeamId === myTeam.id;
  const canBid = myTeam && !isLeading && !isExpired;

  if (!currentPlayer || !room) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 48, height: 48, border: "4px solid var(--border)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const nextPlayerNum = (room?.currentPlayerIdx || 0) + 1;
  const totalPlayers = room?.playerQueue?.length || 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Overlays */}
      <SoldOverlay data={soldOverlay} />
      <UnsoldOverlay data={unsoldOverlay} />

      {/* Floating emojis */}
      <div style={{ position: "fixed", bottom: 80, right: 24, zIndex: 60, pointerEvents: "none" }}>
        <AnimatePresence>
          {emojiReactions.map(r => (
            <motion.div key={r.id} initial={{ opacity: 1, y: 0, x: r.x - 50 }} animate={{ opacity: 0, y: -120, x: r.x - 50 }}
              transition={{ duration: 2 }} style={{ position: "absolute", bottom: 0, fontSize: 28 }}>
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,10,15,0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 900, color: "var(--gold)", fontSize: 18 }}>🏏 PACCE</span>
          <span className="badge badge-green" style={{ animation: "pulseDot 2s infinite" }}>LIVE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Player {nextPlayerNum}/{totalPlayers}</span>
          <span className="font-mono badge badge-gold" style={{ letterSpacing: "0.12em" }}>{code}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setDrawerOpen(!drawerOpen)}>👥 Teams</button>
        </div>
      </header>

      {/* Main grid */}
      <div style={{ flex: 1, display: "flex", gap: 0, maxWidth: 1280, margin: "0 auto", width: "100%", padding: "24px 20px", alignItems: "flex-start" }}>
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 20, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Player card */}
          <motion.div key={currentPlayer.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
            <PlayerCard player={currentPlayer} />
          </motion.div>

          {/* Bid Panel */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              {/* Current bid */}
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>Current Bid</div>
                <motion.div key={currentAuction.currentBidLakhs}
                  initial={{ scale: 1.2, color: "#FFCF5C" }} animate={{ scale: 1, color: "#F5A623" }}
                  style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {currentAuction.currentBidLakhs > 0 ? formatLakhs(currentAuction.currentBidLakhs) : "—"}
                </motion.div>
                {isLeading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="badge badge-green" style={{ marginTop: 8, display: "inline-flex" }}>
                    ⭐ You are leading!
                  </motion.div>
                )}
                {currentAuction.leadingTeamId && !isLeading && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)" }}>
                    Leading: <span style={{ color: "var(--text)", fontWeight: 700 }}>{teams.find(t => t.id === currentAuction.leadingTeamId)?.teamName}</span>
                  </div>
                )}
              </div>
              {/* Timer */}
              <TimerArc timerEnd={timerEnd} totalSeconds={room.timerSeconds} />
            </div>

            {/* Bid buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[{ label: "+₹25L", val: 25 }, { label: "+₹50L", val: 50 }, { label: "+₹1Cr", val: 100 }].map(b => (
                <button key={b.val} className="btn btn-ghost"
                  onClick={() => placeBid(b.val)}
                  disabled={!canBid || bidding || (myTeam && (currentAuction.currentBidLakhs + b.val) > myTeam.purseRemaining)}
                  style={{ fontWeight: 700, fontSize: 15, padding: "14px 0" }}>
                  {b.label}
                </button>
              ))}
            </div>

            {isLeading ? (
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <button className="btn btn-gold btn-lg btn-full" disabled style={{ fontSize: 18, padding: "16px", opacity: 0.9 }}>
                  ✅ You're Leading!
                </button>
                <button className="btn btn-danger btn-lg" onClick={withdrawBid} disabled={bidding || (myTeam.withdrawsRemaining || 0) <= 0}
                  style={{ fontSize: 14, padding: "0 16px", flexShrink: 0, background: "var(--danger)", color: "#fff", border: "none" }}>
                  Withdraw<br/>({myTeam.withdrawsRemaining || 0} left)
                </button>
              </div>
            ) : (
              <button className="btn btn-gold btn-lg btn-full"
                onClick={() => placeBid(25)} disabled={!canBid || bidding || !myTeam}
                style={{ fontSize: 18, padding: "16px", marginBottom: 10 }}>
                {bidding ? "Placing..." : isExpired ? "⏰ Time's Up" : "🔨 Place Bid"}
              </button>
            )}

            {isAdmin && (
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => advancePlayer("sold")} disabled={!currentAuction.leadingTeamId} style={{ flex: 1 }}>🔨 Hammer</button>
                <button className="btn btn-ghost btn-sm" onClick={() => advancePlayer("unsold")} style={{ flex: 1 }}>⏭ Next</button>
              </div>
            )}

            {/* Emoji reactions */}
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 20 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => sendReaction(e)}
                  style={{ fontSize: 22, background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: 8, transition: "transform 0.15s" }}
                  onMouseDown={el => { (el.currentTarget.style.transform = "scale(1.4)"); }}
                  onMouseUp={el => { (el.currentTarget.style.transform = "scale(1)"); }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Bid ticker */}
          {bidFeed.length > 0 && (
            <div style={{ overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 16px" }}>
              <div style={{ display: "flex", gap: 32, fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {bidFeed.map(b => (
                  <span key={b.id}><span style={{ color: "var(--gold)", fontWeight: 700 }}>{b.teamName}</span> bid {formatLakhs(b.amountLakhs)}</span>
                ))}
              </div>
            </div>
          )}

          {/* Purse info */}
          {myTeam && (
            <div className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>💰 Your Purse Remaining</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: getPurseColor(myTeam.purseRemaining, room.purseLakhs) }}>{formatPurse(myTeam.purseRemaining)}</span>
            </div>
          )}
        </div>

        {/* Right: Teams sidebar (desktop) */}
        <div style={{ width: 320, flexShrink: 0, display: "none" }} className="desktop-sidebar">
          <TeamsSidebar teams={teams} myTeam={myTeam} totalPurse={room.purseLakhs} room={room} />
        </div>
      </div>

      {/* Mobile teams drawer */}
      <div className={`bottom-drawer ${drawerOpen ? "open" : ""}`} style={{ zIndex: 50 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700 }}>Teams</h3>
          <button onClick={() => setDrawerOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <TeamsSidebar teams={teams} myTeam={myTeam} totalPurse={room.purseLakhs} room={room} />
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes countdownPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @media(min-width:900px){.desktop-sidebar{display:block!important}}
      `}</style>
    </div>
  );
}
