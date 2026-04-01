"use client";
import { useCallback } from "react";
import { useAuctionStore } from "@/lib/stores/auctionStore";
import { EmojiReaction } from "@/lib/types";

const EMOJIS = ["🔥", "😍", "💰", "⭐", "💀", "👋"];

export function useEmojiReactions() {
  const { emojiReactions, addEmojiReaction, removeEmojiReaction } = useAuctionStore();

  const sendReaction = useCallback((emoji: string) => {
    const reaction: EmojiReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji,
      x: 20 + Math.random() * 60,
    };
    addEmojiReaction(reaction);
    setTimeout(() => removeEmojiReaction(reaction.id), 2200);
  }, [addEmojiReaction, removeEmojiReaction]);

  return { emojiReactions, sendReaction, EMOJIS };
}
