# 🏏 Auction 11 — Web App

Real-time multiplayer IPL fantasy cricket auction, built with **Next.js 14 + Firebase**.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage)
- **State**: Zustand + TanStack Query
- **Animations**: Framer Motion

## Setup

### 1. Firebase Console Setup
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Open project `careerforge-ai-2be7d`
3. **Authentication** → Sign-in methods → Enable **Google** and **Anonymous**
4. **Firestore** → Create database (production mode) → Deploy rules from `firestore.rules`

### 2. Run Locally
```bash
npm run dev
```
App runs at **http://localhost:3000**

### 3. Deploy to Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

## Game Flow
1. **Landing (/)** — Sign in with Google or play as Guest
2. **Home (/home)** — Create or join a room
3. **Create (/create)** — Configure purse, squad size, timer, select players
4. **Join (/join/[code])** — Enter 6-char code + team name
5. **Lobby (/room/[code]/lobby)** — Wait for players, admin starts auction
6. **Auction (/room/[code]/auction)** — Live bidding with countdown timer
7. **Results (/room/[code]/results)** — Leaderboard and squad viewer

## Bidding Rules
- Increments: +₹25L / +₹50L / +₹1Cr
- Cannot bid if already leading or insufficient purse
- Timer resets on each bid (server-side)
- 4 withdraws per team
- Unsold players skipped at end

## Firestore Collections
```
rooms/{roomCode}
  teams/{teamId}
  auctions/{auctionId}
  bidHistory/{bidId}
players/{playerId}
```
