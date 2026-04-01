export type RoomStatus = "lobby" | "auction" | "completed";
export type PlayerRole = "batsman" | "bowler" | "allrounder" | "wk";
export type AuctionStatus = "bidding" | "sold" | "unsold";
export type PlayerOrder = "random" | "by_category";

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  country: string;
  basePriceLakhs: number;
  battingStyle: string;
  bowlingStyle: string;
  photoUrl?: string;
  previousTeam?: string | null;
  isCapped: boolean;
}

export interface Room {
  id: string;
  roomCode: string;
  adminUserId: string;
  status: RoomStatus;
  purseLakhs: number;
  squadSize: number;
  timerSeconds: number;
  playerOrder: PlayerOrder;
  isPublic: boolean;
  playerQueue: string[];
  currentPlayerIdx: number;
  selectedPlayerIds: string[];
  createdAt: Date;
}

export interface Team {
  id: string;
  roomId: string;
  userId: string;
  teamName: string;
  purseRemaining: number;
  playersAcquired: string[];
  withdrawsRemaining: number;
  isBot?: boolean;
  createdAt: Date;
}

export interface CurrentAuction {
  roomId: string;
  playerId: string;
  currentBidLakhs: number;
  leadingTeamId: string | null;
  timerEnd: Date;
  status: AuctionStatus;
  bidCount: number;
}

export interface BidEntry {
  id: string;
  teamId: string;
  teamName: string;
  amountLakhs: number;
  placedAt: Date;
}

export interface EmojiReaction {
  id: string;
  emoji: string;
  x: number;
}

export type BidIncrement = 25 | 50 | 100;

export interface AuctionState {
  room: Room | null;
  currentAuction: CurrentAuction | null;
  currentPlayer: Player | null;
  teams: Team[];
  myTeam: Team | null;
  bidFeed: BidEntry[];
  soldOverlay: { player: Player; team: Team; price: number } | null;
  unsoldOverlay: { player: Player } | null;
  isOnline: boolean;
}
