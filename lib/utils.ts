import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatLakhs(lakhs: number): string {
  if (lakhs >= 100) {
    const cr = lakhs / 100;
    return `₹${cr % 1 === 0 ? cr : cr.toFixed(2)} Cr`;
  }
  return `₹${lakhs}L`;
}

export function formatPurse(lakhs: number): string {
  if (lakhs >= 100) {
    return `₹${(lakhs / 100).toFixed(1)} Cr`;
  }
  return `₹${lakhs}L`;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case "wk": return "bg-purple-600 text-white";
    case "batsman": return "bg-blue-600 text-white";
    case "bowler": return "bg-green-600 text-white";
    case "allrounder": return "bg-yellow-600 text-white";
    default: return "bg-gray-600 text-white";
  }
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case "wk": return "WK";
    case "batsman": return "BAT";
    case "bowler": return "BWL";
    case "allrounder": return "AR";
    default: return role.toUpperCase();
  }
}

export function getPurseColor(remaining: number, total: number): string {
  const pct = (remaining / total) * 100;
  if (pct > 50) return "#22C55E";
  if (pct > 20) return "#F59E0B";
  return "#EF4444";
}

export function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    "India": "🇮🇳", "West Indies": "🏝️", "Australia": "🇦🇺", "England": "🏴",
    "South Africa": "🇿🇦", "New Zealand": "🇳🇿", "Pakistan": "🇵🇰", "Sri Lanka": "🇱🇰",
    "Afghanistan": "🇦🇫", "Bangladesh": "🇧🇩", "Ireland": "🇮🇪", "Zimbabwe": "🇿🇼",
  };
  return flags[country] || "🏏";
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateBotTeam() {
  const cities = ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Kolkata", "Hyderabad", "Rajasthan", "Punjab", "Gujarat", "Lucknow", "Pune", "Kochi", "Goa"];
  const mascots = ["Mavericks", "Dashers", "Strikers", "Royals", "Kings", "Supergiants", "Titans", "Rangers", "Warriors", "Knights"];
  const firstNames = ["Aarav", "Rohan", "Vikram", "Kabir", "Arjun", "Karan", "Rahul", "Aditya", "Sameer", "Varun", "Nikhil"];
  const lastNames = ["Sharma", "Verma", "Singh", "Patel", "Reddy", "Rao", "Kumar", "Gupta", "Jain", "Mehta"];

  const city = cities[Math.floor(Math.random() * cities.length)];
  const mascot = mascots[Math.floor(Math.random() * mascots.length)];
  const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
  const ln = lastNames[Math.floor(Math.random() * lastNames.length)];

  return {
    teamName: `${city} ${mascot}`,
    ownerName: `${fn} ${ln}`,
  };
}
