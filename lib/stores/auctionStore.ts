"use client";
import { create } from "zustand";
import { AuctionState, Room, CurrentAuction, Player, Team, BidEntry, EmojiReaction } from "@/lib/types";

interface AuctionStore extends AuctionState {
  emojiReactions: EmojiReaction[];
  setRoom: (room: Room | null) => void;
  setCurrentAuction: (auction: CurrentAuction | null) => void;
  setCurrentPlayer: (player: Player | null) => void;
  setTeams: (teams: Team[]) => void;
  setMyTeam: (team: Team | null) => void;
  addBidEntry: (entry: BidEntry) => void;
  clearBidFeed: () => void;
  setSoldOverlay: (data: { player: Player; team: Team; price: number } | null) => void;
  setUnsoldOverlay: (data: { player: Player } | null) => void;
  setIsOnline: (online: boolean) => void;
  addEmojiReaction: (reaction: EmojiReaction) => void;
  removeEmojiReaction: (id: string) => void;
}

export const useAuctionStore = create<AuctionStore>((set) => ({
  room: null,
  currentAuction: null,
  currentPlayer: null,
  teams: [],
  myTeam: null,
  bidFeed: [],
  soldOverlay: null,
  unsoldOverlay: null,
  isOnline: true,
  emojiReactions: [],

  setRoom: (room) => set({ room }),
  setCurrentAuction: (currentAuction) => set({ currentAuction }),
  setCurrentPlayer: (currentPlayer) => set({ currentPlayer }),
  setTeams: (teams) => set({ teams }),
  setMyTeam: (myTeam) => set({ myTeam }),
  addBidEntry: (entry) =>
    set((state) => ({ bidFeed: [entry, ...state.bidFeed].slice(0, 20) })),
  clearBidFeed: () => set({ bidFeed: [] }),
  setSoldOverlay: (soldOverlay) => set({ soldOverlay }),
  setUnsoldOverlay: (unsoldOverlay) => set({ unsoldOverlay }),
  setIsOnline: (isOnline) => set({ isOnline }),
  addEmojiReaction: (reaction) =>
    set((state) => ({ emojiReactions: [...state.emojiReactions, reaction] })),
  removeEmojiReaction: (id) =>
    set((state) => ({
      emojiReactions: state.emojiReactions.filter((r) => r.id !== id),
    })),
}));
