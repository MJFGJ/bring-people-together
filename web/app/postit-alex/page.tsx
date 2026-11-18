"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { usePartySocket } from "partysocket/react";
import styles from "./postit.module.css";
import type { PostitServerMessage } from "@/lib/postitRealtimeTypes";

type Role = "admin" | "member";

interface Person {
  id: string;
  name: string;
  first: string;
  email: string;
  username: string;
  color: string;
  fg: string;
}

const PEOPLE: Person[] = [
  { id: "maya", name: "Maya Chen", first: "Maya", email: "maya@crew.co", username: "@maya.chen", color: "#E4572E", fg: "#fff" },
  { id: "jordan", name: "Jordan Reyes", first: "Jordan", email: "jordan@crew.co", username: "@jordan.reyes", color: "#2F6FEB", fg: "#fff" },
  { id: "sam", name: "Sam Okafor", first: "Sam", email: "sam@crew.co", username: "@sam.okafor", color: "#13A06B", fg: "#fff" },
  { id: "lena", name: "Lena Park", first: "Lena", email: "lena@crew.co", username: "@lena.park", color: "#8B5CF6", fg: "#fff" },
  { id: "theo", name: "Theo Brooks", first: "Theo", email: "theo@crew.co", username: "@theo.brooks", color: "#E3A008", fg: "#1F1604" },
];

const byId = (id: string) => PEOPLE.find((p) => p.id === id)!;
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 62%, 48%)`;
}

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface Photo {
  id: string;
  name: string;
  url: string | null;
  tone: number;
  uploadedBy: string;
  at: number;
  folderId: string | null;
}

type Vote = "up" | "down";

interface Draft {
  slideIds: string[];
  caption: string;
  votes: Record<string, Record<string, Vote>>;
  location?: string;
  hideLikeCount?: boolean;
  commentsOff?: boolean;
  instagramAccountId?: string | null;
  audio?: string;
  taggedPeople?: string[];
  taggedProducts?: string[];
  aiLabel?: boolean;
  audience?: "everyone" | "close";
  shareFacebook?: boolean;
  shareThreads?: boolean;
}

interface PostCard {
  id: string;
  name: string;
  date: string;
  folderId: string;
  drafts: number;
  ready: number;
  pending: number;
  draft: Draft;
  posted: boolean;
  postedAt: number | null;
  scheduledFor: number | null;
}

function groupMediaPool(group: Group): Photo[] {
  return [...group.media].sort((a, b) => b.at - a.at);
}

interface Member {
  id: string;
  name: string;
  email: string;
  username: string;
  role: Role;
  color: string;
  fg: string;
}

function memberFromPerson(id: string, role: Role): Member {
  const p = byId(id);
  return { id: p.id, name: p.name, email: p.email, username: p.username, role, color: p.color, fg: p.fg };
}

function isValidIdentifier(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t.startsWith("@")) return t.length > 1;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function nameFromIdentifier(identifier: string): string {
  const t = identifier.trim();
  const local = t.startsWith("@") ? t.slice(1) : t.split("@")[0];
  const spaced = local.replace(/[._-]+/g, " ").trim();
  return spaced ? spaced.replace(/\b\w/g, (c) => c.toUpperCase()) : t;
}

function makeMember(identifier: string, role: Role): Member {
  const t = identifier.trim();
  const isUsername = t.startsWith("@");
  const id = `${slugify(t)}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    name: nameFromIdentifier(t),
    email: isUsername ? "" : t,
    username: isUsername ? t : "",
    role,
    color: hashColor(t),
    fg: "#fff",
  };
}

function findKnownContact(identifier: string, contacts: Member[]): Member | undefined {
  const t = identifier.trim().toLowerCase();
  if (!t) return undefined;
  const bare = t.replace(/^@/, "");
  return contacts.find((c) => (c.email && c.email.toLowerCase() === t) || (c.username && c.username.toLowerCase().replace(/^@/, "") === bare));
}

interface ChatMessage {
  id: string;
  at: number;
  authorId: string;
  authorName: string;
  color: string;
  fg: string;
  text: string;
}

interface BoardNote {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
  text: string;
  authorName: string;
  authorColor: string;
}

interface BoardStroke {
  id: string;
  color: string;
  size: number;
  points: [number, number][];
  authorId: string;
}

interface Board {
  notes: BoardNote[];
  strokes: BoardStroke[];
}

const EMPTY_BOARD: Board = { notes: [], strokes: [] };

interface ActivityItem {
  id: string;
  at: number;
  actorName: string;
  color: string;
  fg: string;
  verb: string;
  target?: string;
  icon: keyof typeof ICON_PATHS;
}

interface InstagramAccount {
  id: string;
  handle: string;
}

interface MediaFolder {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  color: string;
  members: Member[];
  instagramAccounts: InstagramAccount[];
  media: Photo[];
  folders: MediaFolder[];
  posts: PostCard[];
  chat: ChatMessage[];
  board?: Board;
  activity: ActivityItem[];
}

function primaryHandle(group: Group): string {
  return group.instagramAccounts[0]?.handle ?? "Not linked";
}

function makeSeedPhotos(count: number, members: string[], startAgoMin: number, folderId: string | null = null): Photo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `seed-${startAgoMin}-${i}`,
    name: `IMG_${1000 + i}.jpg`,
    url: null,
    tone: (i * 37 + 20) % 80 + 10,
    uploadedBy: members.length ? byId(members[i % members.length]).name : "Team",
    at: Date.now() - (startAgoMin - i) * 60000,
    folderId,
  }));
}

const GROUP_COLORS = ["#E4572E", "#2F6FEB", "#13A06B", "#8B5CF6", "#E3A008", "#D2433F", "#0E9F9F"];

// A synced snapshot could come from a stale client, a bad write, or just not
// exist yet — rather than trust it blindly (and crash every viewer on one bad
// write, since there's no schema enforcement on the shared store), check it
// looks like real Group data before adopting it. An invalid snapshot is
// treated the same as "nothing synced yet," so the next client to connect
// reseeds the room with good data.
function isValidGroupsSnapshot(data: unknown): data is Group[] {
  return (
    Array.isArray(data) &&
    data.every(
      (g) =>
        g &&
        typeof g === "object" &&
        typeof g.id === "string" &&
        typeof g.name === "string" &&
        Array.isArray(g.members) &&
        Array.isArray(g.posts) &&
        Array.isArray(g.media) &&
        Array.isArray(g.folders) &&
        Array.isArray(g.instagramAccounts)
    )
  );
}

function makeInitialGroups(): Group[] {
  const lookbookPhotos = makeSeedPhotos(13, ["jordan", "lena", "maya"], 70, "folder-p1");
  const cafePhotos = makeSeedPhotos(9, ["maya", "sam"], 48, "folder-p2");
  const btsPhotos = makeSeedPhotos(6, ["sam", "lena", "jordan"], 30, "folder-p3");
  return [
    {
      id: "ribbonclub",
      name: "Ribbon Club",
      color: "#E4572E",
      members: [memberFromPerson("jordan", "admin"), memberFromPerson("lena", "member"), memberFromPerson("maya", "member")],
      instagramAccounts: [{ id: "ig-ribbonclub", handle: "@ribbonclub" }],
      media: lookbookPhotos,
      folders: [{ id: "folder-p1", name: "Lookbook Shoot" }],
      posts: [
        {
          id: "p1",
          name: "Lookbook Shoot",
          date: "Shot Nov 8",
          folderId: "folder-p1",
          drafts: 3,
          ready: 1,
          pending: 2,
          draft: {
            slideIds: [lookbookPhotos[0].id, lookbookPhotos[3].id, lookbookPhotos[5].id],
            caption: "New drop for the holidays. #RibbonClub",
            votes: {
              [lookbookPhotos[0].id]: { jordan: "up", maya: "up", lena: "up" },
              [lookbookPhotos[3].id]: { jordan: "up", maya: "down" },
              [lookbookPhotos[5].id]: {},
            },
          },
          posted: false,
          postedAt: null,
          scheduledFor: null,
        },
      ],
      chat: [
        { id: "c1", at: Date.now() - 55 * 60000, authorId: "jordan", authorName: "Jordan Reyes", color: "#2F6FEB", fg: "#fff", text: "Just uploaded the lookbook shots, can everyone take a look?" },
        { id: "c2", at: Date.now() - 50 * 60000, authorId: "maya", authorName: "Maya Chen", color: "#E4572E", fg: "#fff", text: "On it! The rooftop ones are 🔥" },
        { id: "c3", at: Date.now() - 40 * 60000, authorId: "lena", authorName: "Lena Park", color: "#8B5CF6", fg: "#fff", text: "Can we use the one with the red jacket as the cover?" },
      ],
      activity: [
        { id: "a1", at: Date.now() - 55 * 60000, actorName: "Jordan Reyes", color: "#2F6FEB", fg: "#fff", verb: "added 13 photos to", target: "Lookbook Shoot", icon: "image" },
        { id: "a2", at: Date.now() - 95 * 60000, actorName: "Maya Chen", color: "#E4572E", fg: "#fff", verb: "created the post", target: "Lookbook Shoot", icon: "folder" },
      ],
    },
    {
      id: "riverfront",
      name: "Riverfront Café",
      color: "#2F6FEB",
      members: [memberFromPerson("maya", "admin"), memberFromPerson("sam", "member")],
      instagramAccounts: [{ id: "ig-riverfront", handle: "@riverfrontcafe" }],
      media: cafePhotos,
      folders: [{ id: "folder-p2", name: "Café Opening" }],
      posts: [
        {
          id: "p2",
          name: "Café Opening",
          date: "Shot Nov 2",
          folderId: "folder-p2",
          drafts: 1,
          ready: 1,
          pending: 0,
          draft: { slideIds: [cafePhotos[1].id], caption: "We're open! First latte is on us this weekend.", votes: { [cafePhotos[1].id]: { maya: "up", sam: "up" } } },
          posted: true,
          postedAt: Date.now() - 2 * 24 * 60 * 60000,
          scheduledFor: null,
        },
      ],
      chat: [
        { id: "c1", at: Date.now() - 3 * 24 * 60 * 60000, authorId: "sam", authorName: "Sam Okafor", color: "#13A06B", fg: "#fff", text: "Got some great shots from the opening, uploading now." },
        { id: "c2", at: Date.now() - 2 * 24 * 60 * 60000 - 30 * 60000, authorId: "maya", authorName: "Maya Chen", color: "#E4572E", fg: "#fff", text: "Perfect, let's post the espresso shot this weekend." },
      ],
      activity: [
        { id: "a1", at: Date.now() - 2 * 24 * 60 * 60000, actorName: "Maya Chen", color: "#E4572E", fg: "#fff", verb: "marked Café Opening as posted", icon: "check" },
        { id: "a2", at: Date.now() - 3 * 24 * 60 * 60000, actorName: "Sam Okafor", color: "#13A06B", fg: "#fff", verb: "added 9 photos to", target: "Café Opening", icon: "image" },
        { id: "a3", at: Date.now() - 3 * 24 * 60 * 60000 - 40 * 60000, actorName: "Maya Chen", color: "#E4572E", fg: "#fff", verb: "created the post", target: "Café Opening", icon: "folder" },
      ],
    },
    {
      id: "studio",
      name: "Postit Studio",
      color: "#13A06B",
      members: [memberFromPerson("sam", "admin"), memberFromPerson("lena", "member"), memberFromPerson("jordan", "member"), memberFromPerson("theo", "member")],
      instagramAccounts: [],
      media: btsPhotos,
      folders: [{ id: "folder-p3", name: "Studio BTS" }],
      posts: [
        {
          id: "p3",
          name: "Studio BTS",
          date: "Ongoing",
          folderId: "folder-p3",
          drafts: 0,
          ready: 0,
          pending: 0,
          draft: { slideIds: [], caption: "", votes: {} },
          posted: false,
          postedAt: null,
          scheduledFor: null,
        },
      ],
      chat: [],
      activity: [{ id: "a1", at: Date.now() - 20 * 60000, actorName: "Sam Okafor", color: "#13A06B", fg: "#fff", verb: "created the post", target: "Studio BTS", icon: "folder" }],
    },
  ];
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "item";

const normalizeHandle = (s: string) => {
  const trimmed = s.trim().replace(/^@/, "");
  return trimmed ? `@${trimmed}` : "";
};

// Testing backdoor: signing up with the username "AAdmin" grants admin
// rights in every group, so testers don't have to be invited as an admin
// everywhere just to try admin-only controls like deleting.
function isMasterAdmin(user: CurrentUser): boolean {
  return user.username.replace(/^@/, "").toLowerCase() === "aadmin";
}

const ICON_PATHS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  comment: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  l: '<path d="m15 18-6-6 6-6"/>',
  r: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  down: '<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>',
  instagram: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
  cursor: '<path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  pin: '<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  sparkle: '<path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9Z"/><path d="M19 17v4"/><path d="M17 19h4"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  share: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  note: '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
  pen: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  pointer: '<path d="M12.586 12.586 19 19"/><path d="M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
} as const;

function Icon({ name, size = 16 }: { name: keyof typeof ICON_PATHS; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}

function Avatar({ name, color, fg = "#fff", size }: { name: string; color: string; fg?: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? `${styles.av} ${styles.avLg}` : size === "sm" ? `${styles.av} ${styles.avSm}` : styles.av;
  const style = { "--c": color, "--cf": fg } as CSSProperties;
  return (
    <span className={cls} style={style} title={name}>
      {initials(name)}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return <i className={styles.dot} style={{ "--c": color } as CSSProperties} />;
}

function PhotoThumb({ photo }: { photo: Photo | null }) {
  if (photo?.url) {
    return <span className={styles.ph} style={{ backgroundImage: `url(${photo.url})`, backgroundSize: "cover", backgroundPosition: "center" }} />;
  }
  return (
    <span className={styles.ph} style={{ "--t": photo?.tone ?? 40 } as CSSProperties}>
      <Icon name="image" size={18} />
    </span>
  );
}

interface Toast {
  id: number;
  text: string;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  username: string;
  instagram?: string;
  color: string;
}

type Stage = "signup" | "connectInstagram" | "groups" | "app";
type Screen = "posts" | "post" | "posted" | "media" | "activity";

let toastId = 0;

export default function PostitPage() {
  const [stage, setStage] = useState<Stage>("signup");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [groups, setGroups] = useState<Group[]>(makeInitialGroups);
  const receivedServerSync = useRef(false);
  // Mirrors `groups` synchronously (unlike React state, which only updates on
  // the next render) so that several updateGroup calls made back-to-back
  // within one handler each build on the last instead of clobbering it.
  const groupsRef = useRef(groups);

  const syncSocket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:8788",
    party: "postit-app",
    room: "alex-copy",
    onOpen() {
      // If nobody else has ever synced a "groups" snapshot yet, seed the
      // shared room with this client's local demo data so everyone who
      // connects after us starts from the same place.
      setTimeout(() => {
        if (!receivedServerSync.current) {
          syncSocket.send(JSON.stringify({ type: "sync", groups }));
        }
      }, 600);
    },
    onMessage(event) {
      const msg: { type?: string; groups?: unknown } = JSON.parse(event.data);
      if (msg.type === "sync" && isValidGroupsSnapshot(msg.groups)) {
        receivedServerSync.current = true;
        groupsRef.current = msg.groups;
        setGroups(msg.groups);
      }
    },
  });

  const syncGroups = (next: Group[]) => {
    syncSocket.send(JSON.stringify({ type: "sync", groups: next }));
  };

  const commitGroups = (next: Group[]) => {
    groupsRef.current = next;
    setGroups(next);
    syncGroups(next);
  };
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("posts");
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingPost, setCreatingPost] = useState(false);
  const [invitingTeam, setInvitingTeam] = useState(false);
  const [linkingInstagram, setLinkingInstagram] = useState(false);
  const [liveCursors, setLiveCursors] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem("postit-alex-live-cursors");
    if (stored !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveCursors(stored !== "0");
    }
  }, []);

  const toggleLiveCursors = () => {
    setLiveCursors((v) => {
      const next = !v;
      window.localStorage.setItem("postit-alex-live-cursors", next ? "1" : "0");
      return next;
    });
  };

  const pushToast = (text: string) => {
    const id = ++toastId;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  const updateGroup = (id: string, fn: (g: Group) => Group) => {
    commitGroups(groupsRef.current.map((g) => (g.id === id ? fn(g) : g)));
  };

  const pushActivity = (groupId: string, entry: Omit<ActivityItem, "id" | "at">) => {
    updateGroup(groupId, (g) => ({
      ...g,
      activity: [{ ...entry, id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now() }, ...g.activity],
    }));
  };

  const handleSignUp = (name: string, email: string, username: string) => {
    const id = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setUser({ id, name, email, username: normalizeHandle(username) || `@${slugify(name)}`, color: hashColor(email || username || name) });
    setStage("connectInstagram");
  };

  const handleFinishOnboarding = (instagram?: string) => {
    setUser((u) => (u ? { ...u, instagram } : u));
    setStage("groups");
    pushToast(instagram ? `Linked <em>${instagram}</em>. Pick a group to get started.` : "Pick a group to get started.");
  };

  const ensureMembership = (groupId: string) => {
    if (!user) return;
    const group = groupsRef.current.find((g) => g.id === groupId);
    if (!group || group.members.some((m) => m.id === user.id)) return;
    const me: Member = { id: user.id, name: user.name, email: user.email, username: user.username, role: "member", color: user.color, fg: "#fff" };
    commitGroups(groupsRef.current.map((g) => (g.id === groupId ? { ...g, members: [...g.members, me] } : g)));
  };

  const handleSelectGroup = (id: string) => {
    ensureMembership(id);
    setActiveGroupId(id);
    setScreen("posts");
    setActivePostId(null);
    setStage("app");
    setMenuOpen(false);
  };

  const handleCreateGroup = (name: string, invitees: Member[], instagramAccounts: InstagramAccount[]) => {
    if (!user) return;
    const id = `${slugify(name)}-${Date.now().toString(36)}`;
    const color = GROUP_COLORS[groups.length % GROUP_COLORS.length];
    const me: Member = { id: user.id, name: user.name, email: user.email, username: user.username, role: "admin", color: user.color, fg: "#fff" };
    const members = [me, ...invitees];
    const makeActivityId = () => `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const activity: ActivityItem[] = [];
    for (const m of invitees) {
      activity.push({
        id: makeActivityId(),
        at: Date.now(),
        actorName: user.name,
        color: user.color,
        fg: "#fff",
        verb: `invited ${m.name} as ${m.role === "admin" ? "an admin" : "a team member"} to`,
        target: name,
        icon: "plus",
      });
    }
    if (instagramAccounts.length) {
      activity.push({
        id: makeActivityId(),
        at: Date.now(),
        actorName: user.name,
        color: user.color,
        fg: "#fff",
        verb: `linked ${instagramAccounts.map((a) => a.handle).join(", ")} to`,
        target: name,
        icon: "instagram",
      });
    }
    const group: Group = { id, name, color, members, instagramAccounts, media: [], folders: [], posts: [], chat: [], activity: activity.reverse() };
    commitGroups([...groupsRef.current, group]);
    setActiveGroupId(id);
    setScreen("posts");
    setActivePostId(null);
    setStage("app");
    setCreatingGroup(false);
    pushToast(
      `Created <em>${name}</em>${invitees.length ? ` with ${invitees.length} teammate${invitees.length === 1 ? "" : "s"}` : ""}.${
        instagramAccounts.length ? "" : " Link an Instagram account before you post."
      }`
    );
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = groupsRef.current.find((g) => g.id === groupId);
    if (!group) return;
    commitGroups(groupsRef.current.filter((g) => g.id !== groupId));
    if (activeGroupId === groupId) {
      setActiveGroupId(null);
      setStage("groups");
      setScreen("posts");
      setActivePostId(null);
    }
    pushToast(`Deleted <em>${group.name}</em>.`);
  };

  const handleSaveMembers = (groupId: string, nextMembers: Member[]) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    let members = nextMembers;
    if (members.length && !members.some((m) => m.role === "admin")) {
      members = members.map((m, i) => (i === 0 ? { ...m, role: "admin" } : m));
    }
    const prevIds = new Set(group.members.map((m) => m.id));
    const nextIds = new Set(members.map((m) => m.id));
    const added = members.filter((m) => !prevIds.has(m.id));
    const removed = group.members.filter((m) => !nextIds.has(m.id));
    updateGroup(groupId, (g) => ({ ...g, members }));
    for (const m of added) {
      pushActivity(groupId, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: `invited ${m.name} as ${m.role === "admin" ? "an admin" : "a team member"} to`, target: group.name, icon: "plus" });
    }
    for (const m of removed) {
      pushActivity(groupId, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: `removed ${m.name} from`, target: group.name, icon: "x" });
    }
    for (const m of members) {
      const prev = group.members.find((p) => p.id === m.id);
      if (prev && prevIds.has(m.id) && prev.role !== m.role) {
        pushActivity(groupId, {
          actorName: user?.name ?? "You",
          color: user?.color ?? "#888",
          fg: "#fff",
          verb: `made ${m.name} ${m.role === "admin" ? "an admin" : "a team member"} in`,
          target: group.name,
          icon: "sliders",
        });
      }
    }
    setInvitingTeam(false);
    pushToast(added.length ? `Invited ${added.map((m) => m.name).join(", ")}.` : "Updated the team.");
  };

  const handleSaveInstagram = (groupId: string, accounts: InstagramAccount[]) => {
    const group = groups.find((g) => g.id === groupId);
    const grew = group ? accounts.length > group.instagramAccounts.length : false;
    updateGroup(groupId, (g) => ({ ...g, instagramAccounts: accounts }));
    setLinkingInstagram(false);
    if (group && grew) {
      pushActivity(groupId, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: "linked Instagram accounts for", target: group.name, icon: "instagram" });
    }
    pushToast(accounts.length ? "Instagram accounts updated." : "Removed all linked accounts.");
  };

  const handleCreatePost = (name: string, when: string) => {
    if (!activeGroupId) return;
    const id = `${slugify(name)}-${Date.now().toString(36)}`;
    const folderId = `folder-${id}`;
    const date = when.trim() || `Added ${formatToday()}`;
    const post: PostCard = {
      id,
      name,
      date,
      folderId,
      drafts: 0,
      ready: 0,
      pending: 0,
      draft: { slideIds: [], caption: "", votes: {} },
      posted: false,
      postedAt: null,
      scheduledFor: null,
    };
    const folder: MediaFolder = { id: folderId, name };
    updateGroup(activeGroupId, (g) => ({ ...g, posts: [...g.posts, post], folders: [...g.folders, folder] }));
    pushActivity(activeGroupId, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: "created the post", target: name, icon: "folder" });
    setActivePostId(id);
    setScreen("post");
    setCreatingPost(false);
    pushToast(`Created <em>${name}</em>. Add some photos to get started.`);
  };

  const handleDeletePost = (groupId: string, postId: string) => {
    const group = groupsRef.current.find((g) => g.id === groupId);
    const post = group?.posts.find((p) => p.id === postId);
    if (!group || !post) return;
    updateGroup(groupId, (g) => ({
      ...g,
      posts: g.posts.filter((p) => p.id !== postId),
      folders: g.folders.filter((f) => f.id !== post.folderId),
      media: g.media.map((m) => (m.folderId === post.folderId ? { ...m, folderId: null } : m)),
    }));
    if (activeGroupId === groupId && activePostId === postId) {
      setActivePostId(null);
      setScreen("posts");
    }
    pushToast(`Deleted <em>${post.name}</em>.`);
  };

  const handleAddMedia = (files: FileList, folderId: string | null = null) => {
    if (!activeGroupId || !user) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!picked.length) return;
    const newPhotos: Photo[] = picked.map((f, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      url: URL.createObjectURL(f),
      tone: (i * 29 + 13) % 85 + 8,
      uploadedBy: user.name,
      at: Date.now(),
      folderId,
    }));
    updateGroup(activeGroupId, (g) => ({ ...g, media: [...g.media, ...newPhotos] }));
    const groupName = groups.find((g) => g.id === activeGroupId)?.name;
    pushActivity(activeGroupId, {
      actorName: user.name,
      color: user.color,
      fg: "#fff",
      verb: `added ${newPhotos.length} ${newPhotos.length === 1 ? "photo" : "photos"} to`,
      target: groupName,
      icon: "image",
    });
    pushToast(`Added ${newPhotos.length} ${newPhotos.length === 1 ? "photo" : "photos"}.`);
  };

  const handleCreateFolder = (name: string) => {
    if (!activeGroupId || !name.trim()) return;
    const folder: MediaFolder = { id: `${slugify(name)}-${Date.now().toString(36)}`, name: name.trim() };
    updateGroup(activeGroupId, (g) => ({ ...g, folders: [...g.folders, folder] }));
  };

  const handleDeleteFolder = (folderId: string) => {
    if (!activeGroupId) return;
    updateGroup(activeGroupId, (g) => ({
      ...g,
      folders: g.folders.filter((f) => f.id !== folderId),
      media: g.media.map((m) => (m.folderId === folderId ? { ...m, folderId: null } : m)),
    }));
  };

  const handleMoveToFolder = (photoId: string, folderId: string | null) => {
    if (!activeGroupId) return;
    updateGroup(activeGroupId, (g) => ({ ...g, media: g.media.map((m) => (m.id === photoId ? { ...m, folderId } : m)) }));
  };

  const handleUpdateDraft = (postId: string, fn: (draft: Draft) => Draft) => {
    if (!activeGroupId) return;
    updateGroup(activeGroupId, (g) => ({
      ...g,
      posts: g.posts.map((p) => (p.id === postId ? { ...p, draft: fn(p.draft) } : p)),
    }));
  };

  const handleSetPosted = (postId: string, posted: boolean) => {
    if (!activeGroupId) return;
    const postName = groups.find((g) => g.id === activeGroupId)?.posts.find((p) => p.id === postId)?.name ?? "a post";
    updateGroup(activeGroupId, (g) => ({
      ...g,
      posts: g.posts.map((p) => (p.id === postId ? { ...p, posted, postedAt: posted ? Date.now() : null, scheduledFor: null } : p)),
    }));
    pushActivity(activeGroupId, {
      actorName: user?.name ?? "You",
      color: user?.color ?? "#888",
      fg: "#fff",
      verb: posted ? `marked ${postName} as posted` : `moved ${postName} back to drafts`,
      icon: posted ? "check" : "folder",
    });
  };

  const handleSchedule = (postId: string, scheduledFor: number) => {
    if (!activeGroupId) return;
    const postName = groups.find((g) => g.id === activeGroupId)?.posts.find((p) => p.id === postId)?.name ?? "a post";
    updateGroup(activeGroupId, (g) => ({
      ...g,
      posts: g.posts.map((p) => (p.id === postId ? { ...p, scheduledFor, posted: false, postedAt: null } : p)),
    }));
    const when = new Date(scheduledFor).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    pushActivity(activeGroupId, {
      actorName: user?.name ?? "You",
      color: user?.color ?? "#888",
      fg: "#fff",
      verb: `scheduled ${postName} for ${when}`,
      icon: "clock",
    });
    pushToast(`Scheduled <em>${postName}</em> for ${when}.`);
  };

  const handleDropPhotoOnPost = (postId: string, photoId: string) => {
    handleUpdateDraft(postId, (draft) => (draft.slideIds.includes(photoId) ? draft : { ...draft, slideIds: [...draft.slideIds, photoId] }));
  };

  const handleUpdateBoard = (groupId: string, fn: (board: Board) => Board) => {
    updateGroup(groupId, (g) => ({ ...g, board: fn(g.board ?? EMPTY_BOARD) }));
  };

  const handleSwitchGroup = () => {
    setStage("groups");
    setScreen("posts");
    setActivePostId(null);
    setMenuOpen(false);
    setInvitingTeam(false);
    setLinkingInstagram(false);
  };

  const handleSignOut = () => {
    setStage("signup");
    setUser(null);
    setActiveGroupId(null);
    setScreen("posts");
    setActivePostId(null);
    setMenuOpen(false);
    setCreatingGroup(false);
    setCreatingPost(false);
    setInvitingTeam(false);
    setLinkingInstagram(false);
  };

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  return (
    <div className={styles.page}>
      {stage === "signup" && <SignupScreen onSignUp={handleSignUp} />}

      {stage === "connectInstagram" && <ConnectInstagramScreen onFinish={handleFinishOnboarding} />}

      {stage === "groups" && user && (
        <GroupPicker
          user={user}
          groups={groups}
          onSelect={handleSelectGroup}
          onCreate={() => setCreatingGroup(true)}
          onSignOut={handleSignOut}
          onDeleteGroup={handleDeleteGroup}
        />
      )}

      {stage === "app" && user && activeGroup && (
        <AppShell
          user={user}
          group={activeGroup}
          screen={screen}
          activePostId={activePostId}
          menuOpen={menuOpen}
          liveCursors={liveCursors}
          onToggleLiveCursors={toggleLiveCursors}
          onToggleMenu={() => setMenuOpen((v) => !v)}
          onSwitchGroup={handleSwitchGroup}
          onSignOut={handleSignOut}
          onInvite={() => setInvitingTeam(true)}
          onOpenInstagram={() => setLinkingInstagram(true)}
          onOpenPosts={() => {
            setScreen("posts");
            setActivePostId(null);
          }}
          onOpenPosted={() => {
            setScreen("posted");
            setActivePostId(null);
          }}
          onOpenActivity={() => {
            setScreen("activity");
            setActivePostId(null);
          }}
          onOpenMedia={() => {
            setScreen("media");
            setActivePostId(null);
          }}
          onOpenPost={(id) => {
            setActivePostId(id);
            setScreen("post");
          }}
          onNewPost={() => setCreatingPost(true)}
          onAddMedia={handleAddMedia}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveToFolder={handleMoveToFolder}
          onUpdateDraft={handleUpdateDraft}
          onSetPosted={handleSetPosted}
          onSchedule={handleSchedule}
          onDropPhotoOnPost={handleDropPhotoOnPost}
          onDeletePost={(postId) => handleDeletePost(activeGroup.id, postId)}
          onUpdateBoard={(fn) => handleUpdateBoard(activeGroup.id, fn)}
        />
      )}

      {creatingGroup && <CreateGroupModal allGroups={groups} onCreate={handleCreateGroup} onCancel={() => setCreatingGroup(false)} />}
      {creatingPost && <CreatePostModal onCreate={handleCreatePost} onCancel={() => setCreatingPost(false)} />}
      {invitingTeam && activeGroup && user && (
        <InviteModal
          group={activeGroup}
          allGroups={groups}
          isAdmin={isMasterAdmin(user) || activeGroup.members.find((m) => m.id === user.id)?.role === "admin"}
          onSave={(members) => handleSaveMembers(activeGroup.id, members)}
          onCancel={() => setInvitingTeam(false)}
        />
      )}
      {linkingInstagram && activeGroup && (
        <InstagramModal group={activeGroup} onSave={(accounts) => handleSaveInstagram(activeGroup.id, accounts)} onCancel={() => setLinkingInstagram(false)} />
      )}

      <div className={styles.toastWrap}>
        {toasts.map((t) => (
          <div key={t.id} className={styles.toast}>
            <span dangerouslySetInnerHTML={{ __html: t.text }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SignupScreen({ onSignUp }: { onSignUp: (name: string, email: string, username: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");

  const canSubmit = name.trim().length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSignUp(name.trim(), email.trim(), username.trim());
  };

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginIntro}>
        <div className={styles.wm}>
          postit<i className={styles.wmDot} />
        </div>
        <p>One shared board for the whole shoot. Upload, credit, vote and build the post together.</p>
        <p className={styles.proto}>Prototype for user testing — nothing you type is sent anywhere.</p>
      </div>
      <form className={styles.loginCard} onSubmit={submit}>
        <h2>Jump in</h2>
        <p className={styles.sub}>Just your name gets you in. Email and a username are optional — add them if you want.</p>
        <div className={styles.field}>
          <label htmlFor="name">Name</label>
          <input id="name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Rivera" autoComplete="name" autoFocus />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">
            Email <span className={styles.fieldNote}>(optional)</span>
          </label>
          <input
            id="email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jamie@example.com"
            autoComplete="email"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="username">
            Username <span className={styles.fieldNote}>(optional)</span>
          </label>
          <input id="username" className={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@jamie.rivera" autoComplete="username" />
        </div>
        <button type="submit" className={styles.btnPrimary} disabled={!canSubmit}>
          Continue
        </button>
      </form>
    </div>
  );
}

function ConnectInstagramScreen({ onFinish }: { onFinish: (instagram?: string) => void }) {
  const [handle, setHandle] = useState("");

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginIntro}>
        <div className={styles.wm}>
          postit<i className={styles.wmDot} />
        </div>
        <p>Link your own Instagram if you&rsquo;d like your profile to show it.</p>
        <p className={styles.proto}>postit is often used at work, so this step is never required.</p>
      </div>
      <div className={styles.loginCard}>
        <h2>Link your Instagram</h2>
        <p className={styles.sub}>Optional — you can always do this later from your profile.</p>
        <div className={styles.field}>
          <label htmlFor="ighandle">Your Instagram handle</label>
          <input id="ighandle" className={styles.input} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@jamie.rivera" />
        </div>
        <button type="button" className={styles.btnPrimary} onClick={() => onFinish(normalizeHandle(handle) || undefined)} disabled={!handle.trim()}>
          Link account
        </button>
        <button type="button" className={styles.skipLink} onClick={() => onFinish(undefined)}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

function GroupPicker({
  user,
  groups,
  onSelect,
  onCreate,
  onSignOut,
  onDeleteGroup,
}: {
  user: CurrentUser;
  groups: Group[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSignOut: () => void;
  onDeleteGroup: (id: string) => void;
}) {
  const first = user.name.trim().split(/\s+/)[0] || user.name;
  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginIntro}>
        <div className={styles.wm}>
          postit<i className={styles.wmDot} />
        </div>
        <p>You can belong to more than one group. Each group manages its own team and posts to its own linked Instagram accounts.</p>
        <p className={styles.proto}>
          Signed in as {user.name}
          {user.email || user.username ? ` · ${user.email || user.username}` : ""} ·{" "}
          <button className={styles.signOutLink} onClick={onSignOut}>
            Sign out
          </button>
        </p>
      </div>
      <div className={styles.loginCard}>
        <h2>Which group do you want to work in, {first}?</h2>
        <p className={styles.sub}>
          {groups.length} {groups.length === 1 ? "group" : "groups"}
        </p>
        <div className={styles.groupList}>
          {groups.map((g) => {
            const canDelete = isMasterAdmin(user) || g.members.find((m) => m.id === user.id)?.role === "admin";
            return (
              <div key={g.id} className={styles.cardWrap}>
                <button className={styles.groupCard} onClick={() => onSelect(g.id)}>
                  <span className={styles.groupIcon} style={{ "--c": g.color } as CSSProperties}>
                    {initials(g.name)}
                  </span>
                  <span className={styles.groupInfo}>
                    <b>{g.name}</b>
                    <span className={styles.handle}>{primaryHandle(g)}</span>
                    <span className={styles.groupStats}>
                      {g.members.length} {g.members.length === 1 ? "person" : "people"} · {g.posts.length} {g.posts.length === 1 ? "post" : "posts"}
                    </span>
                  </span>
                  <span className={styles.groupDots}>
                    {g.members.map((m) => (
                      <Dot key={m.id} color={m.color} />
                    ))}
                  </span>
                </button>
                {canDelete && (
                  <button
                    className={styles.cardDelete}
                    title="Delete group"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${g.name}"? This can't be undone.`)) onDeleteGroup(g.id);
                    }}
                  >
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
            );
          })}
          <button className={`${styles.groupCard} ${styles.groupNew}`} onClick={onCreate}>
            <Icon name="plus" size={18} /> Create a group
          </button>
        </div>
      </div>
    </div>
  );
}

interface DraftMember {
  key: string;
  identifier: string;
  role: Role;
  existing?: Member;
}

function draftsToMembers(drafts: DraftMember[], contacts: Member[]): Member[] {
  return drafts
    .filter((d) => isValidIdentifier(d.identifier))
    .map((d) => {
      if (d.existing) return { ...d.existing, role: d.role };
      const known = findKnownContact(d.identifier, contacts);
      if (known) return { ...known, role: d.role };
      return makeMember(d.identifier, d.role);
    });
}

function TeamEditor({
  drafts,
  setDrafts,
  allGroups,
  canRemoveMembers = true,
}: {
  drafts: DraftMember[];
  setDrafts: (fn: (d: DraftMember[]) => DraftMember[]) => void;
  allGroups: Group[];
  canRemoveMembers?: boolean;
}) {
  const addRow = () => setDrafts((d) => [...d, { key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, identifier: "", role: "member" }]);
  const removeRow = (key: string) => setDrafts((d) => d.filter((r) => r.key !== key));
  const updateRow = (key: string, patch: Partial<DraftMember>) => setDrafts((d) => d.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const contacts = allGroups.flatMap((g) => g.members);
  const presentKeys = new Set(drafts.map((d) => d.identifier.trim().toLowerCase().replace(/^@/, "")).filter(Boolean));
  const freq = new Map<string, { member: Member; count: number }>();
  for (const m of contacts) {
    const key = (m.email || m.username).toLowerCase().replace(/^@/, "");
    if (!key || presentKeys.has(key)) continue;
    const prev = freq.get(key);
    if (prev) prev.count++;
    else freq.set(key, { member: m, count: 1 });
  }
  const suggestions = [...freq.values()].sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <div className={styles.memberEditor}>
      {drafts.map((d) => (
        <div key={d.key} className={styles.memberRow}>
          <input
            className={styles.input}
            placeholder="Email or @username"
            value={d.identifier}
            onChange={(e) => updateRow(d.key, { identifier: e.target.value, existing: undefined })}
          />
          <div className={styles.roleToggle}>
            <button type="button" className={`${styles.roleBtn} ${d.role === "member" ? styles.roleBtnOn : ""}`} onClick={() => updateRow(d.key, { role: "member" })}>
              Member
            </button>
            <button type="button" className={`${styles.roleBtn} ${d.role === "admin" ? styles.roleBtnOn : ""}`} onClick={() => updateRow(d.key, { role: "admin" })}>
              Admin
            </button>
          </div>
          {(canRemoveMembers || !d.existing) && (
            <button type="button" className={styles.iconClose} onClick={() => removeRow(d.key)} title="Remove">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      ))}
      <button type="button" className={styles.btnGhost} onClick={addRow}>
        <Icon name="plus" size={14} /> Add teammate
      </button>
      {suggestions.length > 0 && (
        <div className={styles.chipRow}>
          <span className={styles.chipLabel}>People you work with often</span>
          {suggestions.map(({ member }) => (
            <button
              type="button"
              key={member.id}
              className={styles.chip}
              onClick={() =>
                setDrafts((d) => [
                  ...d,
                  { key: `sugg-${member.id}-${Date.now()}`, identifier: member.email || member.username, role: "member", existing: member },
                ])
              }
            >
              + {member.name.split(/\s+/)[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InstagramEditor({ handles, setHandles }: { handles: string[]; setHandles: (fn: (h: string[]) => string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const h = normalizeHandle(input);
    if (h && !handles.some((x) => x.toLowerCase() === h.toLowerCase())) setHandles((hs) => [...hs, h]);
    setInput("");
  };
  return (
    <div className={styles.igEditor}>
      <div className={styles.igRow}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="@youraccount"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className={styles.btnGhost2} onClick={add} disabled={!input.trim()}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
      {handles.length > 0 && (
        <div className={styles.chipRow}>
          {handles.map((h) => (
            <span key={h} className={`${styles.chip} ${styles.igChip}`}>
              <Icon name="instagram" size={12} /> {h}
              <button type="button" onClick={() => setHandles((hs) => hs.filter((x) => x !== h))} title="Remove">
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateGroupModal({
  allGroups,
  onCreate,
  onCancel,
}: {
  allGroups: Group[];
  onCreate: (name: string, invitees: Member[], instagramAccounts: InstagramAccount[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<DraftMember[]>([]);
  const [igHandles, setIgHandles] = useState<string[]>([]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const contacts = allGroups.flatMap((g) => g.members);
    onCreate(
      name.trim(),
      draftsToMembers(drafts, contacts),
      igHandles.map((h) => ({ id: `${slugify(h)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, handle: h }))
    );
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <form className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Create a group</h2>
        <p className={styles.sub}>Each group has its own team and posts to its own Instagram accounts.</p>
        <div className={styles.field}>
          <label htmlFor="gname">Group name</label>
          <input id="gname" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Outdoors" autoFocus />
        </div>
        <div className={styles.field}>
          <label>Invite teammates (optional)</label>
          <p className={styles.fieldNote}>Admins have final say on posting. Team members can request a post for an admin to approve.</p>
          <TeamEditor drafts={drafts} setDrafts={setDrafts} allGroups={allGroups} />
        </div>
        <div className={styles.field}>
          <label>Link Instagram accounts</label>
          <p className={styles.fieldNote}>Optional for now — you&rsquo;ll need at least one linked account before this group can post.</p>
          <InstagramEditor handles={igHandles} setHandles={setIgHandles} />
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={!name.trim()}>
            Create group
          </button>
        </div>
      </form>
    </div>
  );
}

function InviteModal({
  group,
  allGroups,
  isAdmin,
  onSave,
  onCancel,
}: {
  group: Group;
  allGroups: Group[];
  isAdmin: boolean;
  onSave: (members: Member[]) => void;
  onCancel: () => void;
}) {
  const [drafts, setDrafts] = useState<DraftMember[]>(() =>
    group.members.map((m) => ({ key: m.id, identifier: m.email || m.username, role: m.role, existing: m }))
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const contacts = allGroups.flatMap((g) => g.members);
    onSave(draftsToMembers(drafts, contacts));
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <form className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Team &amp; roles</h2>
        <p className={styles.sub}>
          Who&rsquo;s in <b>{group.name}</b>. Admins can post; team members can request a post.
        </p>
        <TeamEditor drafts={drafts} setDrafts={setDrafts} allGroups={allGroups} canRemoveMembers={isAdmin} />
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.btnPrimary}>
            Save team
          </button>
        </div>
      </form>
    </div>
  );
}

function InstagramModal({
  group,
  onSave,
  onCancel,
}: {
  group: Group;
  onSave: (accounts: InstagramAccount[]) => void;
  onCancel: () => void;
}) {
  const [handles, setHandles] = useState<string[]>(group.instagramAccounts.map((a) => a.handle));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(handles.map((h) => ({ id: `${slugify(h)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, handle: h })));
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Instagram accounts</h2>
        <p className={styles.sub}>
          Accounts <b>{group.name}</b> can post to. You need at least one linked account to mark a post as posted.
        </p>
        <InstagramEditor handles={handles} setHandles={setHandles} />
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.btnPrimary}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function CreatePostModal({ onCreate, onCancel }: { onCreate: (name: string, when: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [when, setWhen] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), when);
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <form className={styles.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Create a post</h2>
        <p className={styles.sub}>A post holds the photos, drafts and votes for one shoot.</p>
        <div className={styles.field}>
          <label htmlFor="pname">Post name</label>
          <input id="pname" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Lookbook" autoFocus />
        </div>
        <div className={styles.field}>
          <label htmlFor="pwhen">When</label>
          <input id="pwhen" className={styles.input} value={when} onChange={(e) => setWhen(e.target.value)} placeholder="Shot Nov 15, or Ongoing" />
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={!name.trim()}>
            Create post
          </button>
        </div>
      </form>
    </div>
  );
}

function AppShell({
  user,
  group,
  screen,
  activePostId,
  menuOpen,
  liveCursors,
  onToggleLiveCursors,
  onToggleMenu,
  onSwitchGroup,
  onSignOut,
  onInvite,
  onOpenInstagram,
  onOpenPosts,
  onOpenPosted,
  onOpenActivity,
  onOpenMedia,
  onOpenPost,
  onNewPost,
  onAddMedia,
  onCreateFolder,
  onDeleteFolder,
  onMoveToFolder,
  onUpdateDraft,
  onSetPosted,
  onSchedule,
  onDropPhotoOnPost,
  onDeletePost,
  onUpdateBoard,
}: {
  user: CurrentUser;
  group: Group;
  screen: Screen;
  activePostId: string | null;
  menuOpen: boolean;
  liveCursors: boolean;
  onToggleLiveCursors: () => void;
  onToggleMenu: () => void;
  onSwitchGroup: () => void;
  onSignOut: () => void;
  onInvite: () => void;
  onOpenInstagram: () => void;
  onOpenPosts: () => void;
  onOpenPosted: () => void;
  onOpenActivity: () => void;
  onOpenMedia: () => void;
  onOpenPost: (id: string) => void;
  onNewPost: () => void;
  onAddMedia: (files: FileList, folderId?: string | null) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveToFolder: (photoId: string, folderId: string | null) => void;
  onUpdateDraft: (postId: string, fn: (draft: Draft) => Draft) => void;
  onSetPosted: (postId: string, posted: boolean) => void;
  onSchedule: (postId: string, scheduledFor: number) => void;
  onDropPhotoOnPost: (postId: string, photoId: string) => void;
  onDeletePost: (postId: string) => void;
  onUpdateBoard: (fn: (board: Board) => Board) => void;
}) {
  const members = group.members;
  const first = user.name.trim().split(/\s+/)[0] || user.name;
  const activePost = group.posts.find((p) => p.id === activePostId) ?? null;
  const isAdmin = isMasterAdmin(user) || group.members.find((m) => m.id === user.id)?.role === "admin";
  const canPost = group.instagramAccounts.length > 0;

  const [cursors, setCursors] = useState<Record<string, { x: number; y: number; color: string; name: string }>>({});
  const lastCursorSent = useRef(0);

  const cursorSocket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:8788",
    party: "postit",
    room: `alex-${group.id}`,
    enabled: liveCursors,
    onOpen() {
      cursorSocket.send(JSON.stringify({ type: "join", name: user.name, color: user.color }));
    },
    onMessage(event) {
      const msg: PostitServerMessage = JSON.parse(event.data);
      if (msg.type === "presence") {
        const ids = new Set(msg.players.map((p) => p.id));
        setCursors((prev) => {
          const next: typeof prev = {};
          for (const [id, c] of Object.entries(prev)) if (ids.has(id)) next[id] = c;
          return next;
        });
      } else if (msg.type === "cursor") {
        setCursors((prev) => ({ ...prev, [msg.playerId]: { x: msg.x, y: msg.y, color: msg.color, name: msg.name } }));
      }
    },
  });

  useEffect(() => {
    if (!liveCursors) return;
    const handleMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastCursorSent.current < 40) return;
      lastCursorSent.current = now;
      cursorSocket.send(JSON.stringify({ type: "cursor", x: e.clientX, y: e.clientY }));
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [liveCursors, cursorSocket]);

  const handleToggleLiveCursors = () => {
    if (liveCursors) setCursors({});
    onToggleLiveCursors();
  };

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <div className={styles.wm}>
          postit<i className={styles.wmDot} />
        </div>
        <nav className={styles.crumb}>
          <button className={styles.crumbBtn} onClick={onSwitchGroup} title="Switch group">
            {group.name}
          </button>
          {screen === "posts" && <span className={styles.handleMono}>{primaryHandle(group)}</span>}
          {screen === "posted" && (
            <>
              <span className={styles.crumbSep}>›</span>
              <span className={styles.crumbCurrent}>Posted</span>
            </>
          )}
          {screen === "activity" && (
            <>
              <span className={styles.crumbSep}>›</span>
              <span className={styles.crumbCurrent}>Activity</span>
            </>
          )}
          {screen === "media" && (
            <>
              <span className={styles.crumbSep}>›</span>
              <span className={styles.crumbCurrent}>Media</span>
            </>
          )}
          {screen === "post" && activePost && (
            <>
              <span className={styles.crumbSep}>›</span>
              <button className={styles.crumbBtn} onClick={onOpenPosts}>
                Posts
              </button>
              <span className={styles.crumbSep}>›</span>
              <span className={styles.crumbCurrent}>{activePost.name}</span>
            </>
          )}
        </nav>
        <div className={styles.grow} />
        <div className={styles.presence}>
          {members.map((p) => (
            <span key={p.id} className={styles.presenceBtn} title={`${p.name} · ${p.role === "admin" ? "Admin" : "Team member"}`}>
              <Avatar name={p.name} color={p.color} fg={p.fg} />
            </span>
          ))}
          <button className={styles.presenceAdd} title="Invite teammates" onClick={onInvite}>
            <Icon name="plus" size={13} />
          </button>
        </div>
        <div className={styles.meWrap}>
          <button className={styles.mebtn} aria-expanded={menuOpen} onClick={onToggleMenu}>
            <Avatar name={user.name} color={user.color} />
            <span>
              <b>{first}</b>
              <small>{user.email || user.username}</small>
            </span>
            <Icon name="chev" size={14} />
          </button>
          {menuOpen && (
            <div className={styles.menu}>
              <div className={styles.mh}>{user.name}</div>
              <button onClick={onSwitchGroup}>Switch group</button>
              <button onClick={handleToggleLiveCursors}>
                <Icon name="cursor" size={14} />
                Live cursors
                <small>{liveCursors ? "On" : "Off"}</small>
              </button>
              <hr />
              <button onClick={onSignOut}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.irail} aria-label="Workspace">
          <button className={`${styles.ib} ${screen === "posts" || screen === "post" ? styles.ibOn : ""}`} title="Posts" onClick={onOpenPosts}>
            <Icon name="folder" size={20} />
            Posts
          </button>
          <button className={`${styles.ib} ${screen === "media" ? styles.ibOn : ""}`} title="Media" onClick={onOpenMedia}>
            <Icon name="image" size={20} />
            Media
          </button>
          <button className={`${styles.ib} ${screen === "posted" ? styles.ibOn : ""}`} title="Posted" onClick={onOpenPosted}>
            <Icon name="check" size={20} />
            Posted
          </button>
          <button className={`${styles.ib} ${screen === "activity" ? styles.ibOn : ""}`} title="Activity" onClick={onOpenActivity}>
            <Icon name="clock" size={20} />
            Activity
          </button>
          <span className={styles.ibSpacer} />
          <button className={styles.ib} title="Instagram accounts" onClick={onOpenInstagram}>
            <Icon name="instagram" size={20} />
            Instagram
          </button>
        </nav>

        <main className={styles.main}>
          {screen === "posts" && (
            <PostsGrid
              group={group}
              members={members}
              view="active"
              isAdmin={isAdmin}
              onOpenPost={onOpenPost}
              onNewPost={onNewPost}
              onDropPhoto={onDropPhotoOnPost}
              onDeletePost={onDeletePost}
            />
          )}
          {screen === "posted" && (
            <PostsGrid
              group={group}
              members={members}
              view="posted"
              isAdmin={isAdmin}
              onOpenPost={onOpenPost}
              onNewPost={onNewPost}
              onDropPhoto={onDropPhotoOnPost}
              onDeletePost={onDeletePost}
            />
          )}
          {screen === "activity" && <ActivityPanel group={group} />}
          {screen === "media" && (
            <MediaPage
              group={group}
              onAddMedia={onAddMedia}
              onCreateFolder={onCreateFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveToFolder={onMoveToFolder}
              onAddToPost={onDropPhotoOnPost}
            />
          )}
          {screen === "post" && activePost && (
            <PostDetail
              key={activePost.id}
              group={group}
              post={activePost}
              me={user}
              isAdmin={isAdmin}
              canPost={canPost}
              onAddMedia={onAddMedia}
              onUpdateDraft={(fn) => onUpdateDraft(activePost.id, fn)}
              onSetPosted={(posted) => onSetPosted(activePost.id, posted)}
              onSchedule={(scheduledFor) => onSchedule(activePost.id, scheduledFor)}
              onDropPhoto={(photoId) => onDropPhotoOnPost(activePost.id, photoId)}
              onOpenInstagram={onOpenInstagram}
            />
          )}
        </main>
      </div>

      <PlanningBoard key={group.id} group={group} me={user} onChange={onUpdateBoard} />

      {liveCursors && (
        <div className={styles.cursorLayer}>
          {Object.entries(cursors).map(([id, c]) => (
            <div key={id} className={styles.remoteCursor} style={{ left: c.x, top: c.y }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={c.color} stroke="#fff" strokeWidth={1.2}>
                <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
              </svg>
              <span className={styles.remoteCursorLabel} style={{ background: c.color }}>
                {c.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const BOARD_W = 3200;
const BOARD_H = 2000;
const NOTE_W = 190;
const NOTE_COLORS = [
  { name: "Yellow", value: "#fff1a8" },
  { name: "Pink", value: "#ffd3e0" },
  { name: "Blue", value: "#cfe2ff" },
  { name: "Green", value: "#d3f4d1" },
];
const PEN_COLORS = ["#1f1f1f", "#1a73e8", "#d93025", "#1e8e3e", "#e37400"];
const PEN_SIZES = [3, 6, 12];

type BoardTool = "select" | "pen" | "eraser";

function strokeToPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M${x} ${y}L${x + 0.1} ${y}`;
  }
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += `Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const last = points[points.length - 1];
  return d + `L${last[0]} ${last[1]}`;
}

function PlanningBoard({ group, me, onChange }: { group: Group; me: CurrentUser; onChange: (fn: (board: Board) => Board) => void }) {
  const [open, setOpen] = useState(false);
  const board = group.board ?? EMPTY_BOARD;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLTextAreaElement)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && <BoardSpace group={group} board={board} me={me} onChange={onChange} onClose={() => setOpen(false)} />}
      {!open && (
        <div className={styles.chatWidget}>
          <button className={styles.chatFab} onClick={() => setOpen(true)} title="Planning board" aria-label="Open planning board">
            <Icon name="note" size={22} />
            {board.notes.length > 0 && <span className={`${styles.chatBadge} ${styles.boardBadge}`}>{board.notes.length}</span>}
          </button>
        </div>
      )}
    </>
  );
}

function BoardSpace({
  group,
  board,
  me,
  onChange,
  onClose,
}: {
  group: Group;
  board: Board;
  me: CurrentUser;
  onChange: (fn: (board: Board) => Board) => void;
  onClose: () => void;
}) {
  const [tool, setTool] = useState<BoardTool>("select");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penSize, setPenSize] = useState(PEN_SIZES[0]);
  const [drawing, setDrawing] = useState<[number, number][] | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number } | null>(null);
  const [ghost, setGhost] = useState<{ color: string; cx: number; cy: number } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const erasingRef = useRef(false);

  const toBoard = (clientX: number, clientY: number) => {
    const r = surfaceRef.current!.getBoundingClientRect();
    return { x: Math.round(clientX - r.left), y: Math.round(clientY - r.top) };
  };
  const topZ = board.notes.reduce((m, n) => Math.max(m, n.z), 0);

  const addNote = (color: string, x: number, y: number) => {
    const id = `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const note: BoardNote = {
      id,
      color,
      text: "",
      x: Math.max(0, Math.min(BOARD_W - NOTE_W, Math.round(x - NOTE_W / 2))),
      y: Math.max(0, Math.min(BOARD_H - 160, Math.round(y - 20))),
      z: topZ + 1,
      authorName: me.name,
      authorColor: me.color,
    };
    onChange((b) => ({ ...b, notes: [...b.notes, note] }));
    setFocusId(id);
    setTool("select");
  };
  const updateNote = (id: string, patch: Partial<BoardNote>) => onChange((b) => ({ ...b, notes: b.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  const deleteNote = (id: string) => onChange((b) => ({ ...b, notes: b.notes.filter((n) => n.id !== id) }));
  const eraseStroke = (id: string) => onChange((b) => ({ ...b, strokes: b.strokes.filter((s) => s.id !== id) }));
  const myLastStroke = [...board.strokes].reverse().find((s) => s.authorId === me.id);

  /* ---- drag a new note out of the tray ---- */
  const startTrayDrag = (e: ReactPointerEvent, color: string) => {
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    setGhost({ color, cx: sx, cy: sy });
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) moved = true;
      setGhost({ color, cx: ev.clientX, cy: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      const view = viewRef.current!.getBoundingClientRect();
      if (!moved) {
        // a plain click drops the note in the middle of what you're looking at
        const p = toBoard(view.left + view.width / 2, view.top + view.height / 2);
        addNote(color, p.x, p.y);
        return;
      }
      const inside = ev.clientX > view.left && ev.clientX < view.right && ev.clientY > view.top && ev.clientY < view.bottom;
      if (inside) {
        const p = toBoard(ev.clientX, ev.clientY);
        addNote(color, p.x, p.y);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---- move an existing note ---- */
  const startNoteDrag = (e: ReactPointerEvent, note: BoardNote) => {
    if (tool !== "select" || (e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const p = toBoard(e.clientX, e.clientY);
    const dx = p.x - note.x;
    const dy = p.y - note.y;
    if (note.z !== topZ) updateNote(note.id, { z: topZ + 1 });
    let cur = { x: note.x, y: note.y };
    setDrag({ id: note.id, x: note.x, y: note.y, dx, dy });
    const move = (ev: PointerEvent) => {
      const q = toBoard(ev.clientX, ev.clientY);
      cur = { x: Math.max(0, Math.min(BOARD_W - NOTE_W, q.x - dx)), y: Math.max(0, Math.min(BOARD_H - 60, q.y - dy)) };
      setDrag({ id: note.id, ...cur, dx, dy });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      if (cur.x !== note.x || cur.y !== note.y) updateNote(note.id, cur);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---- pan the empty board / draw / erase ---- */
  const onSurfaceDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tool === "select") {
      if (e.target !== e.currentTarget) return;
      const v = viewRef.current!;
      panRef.current = { x: e.clientX, y: e.clientY, sl: v.scrollLeft, st: v.scrollTop };
      e.currentTarget.setPointerCapture(e.pointerId);
      (document.activeElement as HTMLElement | null)?.blur();
    }
  };
  const onSurfaceMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    const v = viewRef.current!;
    v.scrollLeft = pan.sl - (e.clientX - pan.x);
    v.scrollTop = pan.st - (e.clientY - pan.y);
  };
  const onSurfaceUp = () => {
    panRef.current = null;
  };

  const onInkDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "pen") {
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = toBoard(e.clientX, e.clientY);
      setDrawing([[p.x, p.y]]);
    } else if (tool === "eraser") {
      erasingRef.current = true;
      const id = (e.target as Element).getAttribute("data-stroke");
      if (id) eraseStroke(id);
    }
  };
  const onInkMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "pen" && drawing) {
      const p = toBoard(e.clientX, e.clientY);
      const last = drawing[drawing.length - 1];
      if (Math.abs(p.x - last[0]) + Math.abs(p.y - last[1]) >= 2) setDrawing([...drawing, [p.x, p.y]]);
    }
  };
  const onInkUp = () => {
    erasingRef.current = false;
    if (tool === "pen" && drawing) {
      const stroke: BoardStroke = { id: `stroke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, color: penColor, size: penSize, points: drawing, authorId: me.id };
      onChange((b) => ({ ...b, strokes: [...b.strokes, stroke] }));
      setDrawing(null);
    }
  };

  const toolBtn = (t: BoardTool, icon: keyof typeof ICON_PATHS, label: string) => (
    <button type="button" className={`${styles.boardTool} ${tool === t ? styles.boardToolOn : ""}`} onClick={() => setTool(t)} title={label} aria-pressed={tool === t}>
      <Icon name={icon} size={17} />
      <span>{label}</span>
    </button>
  );

  const empty = board.notes.length === 0 && board.strokes.length === 0;

  return (
    <div className={styles.boardOverlay} role="dialog" aria-label={`${group.name} planning board`}>
      <div className={styles.boardBar}>
        <div className={styles.boardTitle}>
          <span className={styles.boardTitleIcon}>
            <Icon name="note" size={18} />
          </span>
          <div>
            <b>{group.name} board</b>
            <span>Everyone in the group can add and move things here</span>
          </div>
        </div>

        <div className={styles.boardTools}>
          <div className={styles.boardToolGroup}>
            {toolBtn("select", "pointer", "Move")}
            {toolBtn("pen", "pen", "Pen")}
            {toolBtn("eraser", "eraser", "Eraser")}
          </div>

          {tool === "pen" && (
            <div className={styles.boardToolGroup}>
              {PEN_COLORS.map((c) => (
                <button key={c} type="button" className={`${styles.penSwatch} ${penColor === c ? styles.penSwatchOn : ""}`} style={{ background: c }} onClick={() => setPenColor(c)} title="Pen color" aria-pressed={penColor === c} />
              ))}
              <span className={styles.boardDivider} />
              {PEN_SIZES.map((sz) => (
                <button key={sz} type="button" className={`${styles.penSize} ${penSize === sz ? styles.penSwatchOn : ""}`} onClick={() => setPenSize(sz)} title={`Pen size ${sz}`} aria-pressed={penSize === sz}>
                  <span style={{ width: sz + 2, height: sz + 2, background: penColor }} />
                </button>
              ))}
            </div>
          )}

          <div className={styles.boardToolGroup}>
            <span className={styles.boardTrayLabel}>Drag a note</span>
            {NOTE_COLORS.map((c) => (
              <button key={c.value} type="button" className={styles.notePad} style={{ background: c.value }} onPointerDown={(e) => startTrayDrag(e, c.value)} title={`${c.name} note: drag onto the board, or click to add`} aria-label={`Add ${c.name.toLowerCase()} note`} />
            ))}
          </div>
        </div>

        <div className={styles.boardActions}>
          <button type="button" className={styles.btnGhost2} onClick={() => myLastStroke && eraseStroke(myLastStroke.id)} disabled={!myLastStroke} title="Undo your last drawing">
            <Icon name="undo" size={15} /> Undo
          </button>
          <button type="button" className={styles.boardClose} onClick={onClose} title="Close board (Esc)" aria-label="Close board">
            <Icon name="x" size={20} />
          </button>
        </div>
      </div>

      <div ref={viewRef} className={`${styles.boardView} ${tool === "select" ? styles.boardViewPan : ""}`}>
        <div
          ref={surfaceRef}
          className={styles.boardSurface}
          style={{ width: BOARD_W, height: BOARD_H }}
          onPointerDown={onSurfaceDown}
          onPointerMove={onSurfaceMove}
          onPointerUp={onSurfaceUp}
          onPointerCancel={onSurfaceUp}
        >
          {[...board.notes]
            .sort((a, b) => a.z - b.z)
            .map((n) => {
              const pos = drag?.id === n.id ? drag : n;
              return (
                <div key={n.id} className={`${styles.stickyNote} ${drag?.id === n.id ? styles.stickyNoteDrag : ""}`} style={{ left: pos.x, top: pos.y, width: NOTE_W, background: n.color }}>
                  <div className={styles.stickyHead} onPointerDown={(e) => startNoteDrag(e, n)}>
                    <span className={styles.stickyDot} style={{ background: n.authorColor }} />
                    <span className={styles.stickyAuthor}>{n.authorName}</span>
                    <button type="button" className={styles.stickyDel} onClick={() => deleteNote(n.id)} title="Delete note" aria-label="Delete note">
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                  <textarea
                    className={styles.stickyText}
                    value={n.text}
                    autoFocus={focusId === n.id}
                    onFocus={() => focusId === n.id && setFocusId(null)}
                    onChange={(e) => updateNote(n.id, { text: e.target.value })}
                    placeholder="Type your idea…"
                    aria-label="Note text"
                  />
                </div>
              );
            })}

          <svg
            className={`${styles.boardInk} ${tool !== "select" ? styles.boardInkActive : ""} ${tool === "eraser" ? styles.boardInkErase : ""}`}
            width={BOARD_W}
            height={BOARD_H}
            onPointerDown={onInkDown}
            onPointerMove={onInkMove}
            onPointerUp={onInkUp}
            onPointerCancel={onInkUp}
          >
            {board.strokes.map((s) => (
              <g key={s.id}>
                <path d={strokeToPath(s.points)} stroke={s.color} strokeWidth={s.size} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {tool === "eraser" && (
                  <path
                    d={strokeToPath(s.points)}
                    data-stroke={s.id}
                    className={styles.inkHit}
                    strokeWidth={Math.max(16, s.size + 10)}
                    fill="none"
                    strokeLinecap="round"
                    onPointerEnter={() => erasingRef.current && eraseStroke(s.id)}
                  />
                )}
              </g>
            ))}
            {drawing && <path d={strokeToPath(drawing)} stroke={penColor} strokeWidth={penSize} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </div>

        {empty && (
          <div className={styles.boardEmpty}>
            <Icon name="note" size={28} />
            <b>Start planning together</b>
            <span>Drag a sticky note from the top bar onto the board, or pick the pen to sketch ideas.</span>
          </div>
        )}
      </div>

      {ghost && <div className={styles.noteGhost} style={{ left: ghost.cx - NOTE_W / 2, top: ghost.cy - 20, width: NOTE_W, background: ghost.color }} />}
    </div>
  );
}

function ActivityPanel({ group }: { group: Group }) {
  return (
    <div className={styles.home}>
      <h1>{group.name} · Activity</h1>
      <p>What&rsquo;s happened recently in {group.name}.</p>
      {group.activity.length === 0 ? (
        <div className={styles.emptyBlock}>
          <p>Nothing yet.</p>
        </div>
      ) : (
        <ul className={styles.activityList}>
          {group.activity.map((it) => (
            <li key={it.id} className={styles.activityRow}>
              <Avatar name={it.actorName} color={it.color} fg={it.fg} size="sm" />
              <span className={styles.activityIcon}>
                <Icon name={it.icon} size={14} />
              </span>
              <span className={styles.activityText}>
                <b>{it.actorName}</b> {it.verb}
                {it.target ? (
                  <>
                    {" "}
                    <b>{it.target}</b>
                  </>
                ) : null}
              </span>
              <span className={styles.activityTime}>{timeAgo(it.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function postedLabel(postedAt: number | null): string {
  if (!postedAt) return "Posted";
  return `Posted ${new Date(postedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function scheduledLabel(scheduledFor: number): string {
  return `Scheduled ${new Date(scheduledFor).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PostsGrid({
  group,
  members,
  view,
  isAdmin,
  onOpenPost,
  onNewPost,
  onDropPhoto,
  onDeletePost,
}: {
  group: Group;
  members: Member[];
  view: "active" | "posted";
  isAdmin: boolean;
  onOpenPost: (id: string) => void;
  onNewPost: () => void;
  onDropPhoto: (postId: string, photoId: string) => void;
  onDeletePost: (postId: string) => void;
}) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const posts = group.posts.filter((p) => (view === "posted" ? p.posted : !p.posted));
  const mediaById = new Map(group.media.map((m) => [m.id, m]));

  return (
    <div className={styles.home}>
      <h1>{view === "posted" ? `${group.name} · Posted` : group.name}</h1>
      <p>
        {primaryHandle(group)} · {posts.length} {posts.length === 1 ? "post" : "posts"}
      </p>
      {posts.length === 0 && view === "posted" ? (
        <div className={styles.emptyBlock}>
          <p>Nothing posted yet. Mark a post as posted once it&rsquo;s live.</p>
        </div>
      ) : (
        <div className={styles.pgrid}>
          {posts.map((post) => {
            const slidePhotos = post.draft.slideIds.map((id) => mediaById.get(id)).filter((p): p is Photo => !!p);
            const cover: (Photo | null)[] = [0, 1, 2].map((i) => slidePhotos[i] ?? null);
            return (
              <div key={post.id} className={styles.cardWrap}>
              <button
                className={`${styles.pc} ${dragOverId === post.id ? styles.pcDrop : ""}`}
                onClick={() => onOpenPost(post.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(post.id);
                }}
                onDragLeave={() => setDragOverId((id) => (id === post.id ? null : id))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverId(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) onDropPhoto(post.id, id);
                }}
              >
                <span className={styles.col}>
                  {cover.map((photo, i) => (
                    <PhotoThumb key={i} photo={photo} />
                  ))}
                </span>
                <span className={styles.pcB}>
                  <b>{post.name}</b>
                  <small>
                    {post.date} · {slidePhotos.length} {slidePhotos.length === 1 ? "photo" : "photos"}
                  </small>
                  <span className={styles.pcF}>
                    {post.posted ? (
                      <span className={`${styles.pill} ${styles.pillOk}`}>
                        <Icon name="check" size={11} /> {postedLabel(post.postedAt)}
                      </span>
                    ) : post.scheduledFor ? (
                      <span className={`${styles.pill} ${styles.pillWarn}`}>
                        <Icon name="clock" size={11} /> {scheduledLabel(post.scheduledFor)}
                      </span>
                    ) : (
                      <>
                        {post.ready > 0 && <span className={`${styles.pill} ${styles.pillOk}`}>{post.ready} ready to post</span>}
                        {post.pending > 0 && <span className={`${styles.pill} ${styles.pillWarn}`}>{post.pending} in progress</span>}
                      </>
                    )}
                    <span className={styles.dots}>
                      {members.map((p) => (
                        <Dot key={p.id} color={p.color} />
                      ))}
                    </span>
                  </span>
                </span>
              </button>
              {isAdmin && (
                <button
                  className={styles.cardDelete}
                  title="Delete post"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${post.name}"? This can't be undone.`)) onDeletePost(post.id);
                  }}
                >
                  <Icon name="x" size={12} />
                </button>
              )}
              </div>
            );
          })}
          {view === "active" && (
            <button className={`${styles.pc} ${styles.pcNew}`} onClick={onNewPost}>
              <Icon name="plus" size={22} /> New post
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PostDetail({
  group,
  post,
  me,
  isAdmin,
  canPost,
  onAddMedia,
  onUpdateDraft,
  onSetPosted,
  onSchedule,
  onDropPhoto,
  onOpenInstagram,
}: {
  group: Group;
  post: PostCard;
  me: CurrentUser;
  isAdmin: boolean;
  canPost: boolean;
  onAddMedia: (files: FileList, folderId?: string | null) => void;
  onUpdateDraft: (fn: (draft: Draft) => Draft) => void;
  onSetPosted: (posted: boolean) => void;
  onSchedule: (scheduledFor: number) => void;
  onDropPhoto: (photoId: string) => void;
  onOpenInstagram: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [slidesDragOver, setSlidesDragOver] = useState(false);
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null);
  const [step, setStep] = useState<PostStep>(post.posted ? 2 : 0);
  const [maxStep, setMaxStep] = useState<PostStep>(post.posted ? 2 : 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mode, setMode] = useState<"now" | "later">(post.scheduledFor ? "later" : "now");
  const [scheduleAt, setScheduleAt] = useState(() => toDatetimeLocal(post.scheduledFor ?? Date.now() + 60 * 60000));
  const topRef = useRef<HTMLDivElement>(null);
  const voterKey = me.id;
  const members = group.members;
  const threshold = Math.max(1, Math.ceil(members.length / 2));

  const pool = groupMediaPool(group);
  const mediaById = new Map(pool.map((p) => [p.id, p]));

  const slideIds = post.draft.slideIds;
  const slides = slideIds.map((id) => mediaById.get(id)).filter((p): p is Photo => !!p);

  const removeSlide = (id: string) => onUpdateDraft((draft) => ({ ...draft, slideIds: draft.slideIds.filter((x) => x !== id) }));

  const moveSlideBefore = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    onUpdateDraft((draft) => {
      if (!draft.slideIds.includes(draggedId)) return draft;
      const ids = draft.slideIds.filter((id) => id !== draggedId);
      const targetIndex = ids.indexOf(targetId);
      if (targetIndex === -1) return draft;
      ids.splice(targetIndex, 0, draggedId);
      return { ...draft, slideIds: ids };
    });
  };

  const setVote = (photoId: string, voter: string, vote: Vote) => {
    onUpdateDraft((draft) => {
      const current = draft.votes[photoId]?.[voter];
      const forPhoto = { ...(draft.votes[photoId] ?? {}) };
      if (current === vote) delete forPhoto[voter];
      else forPhoto[voter] = vote;
      return { ...draft, votes: { ...draft.votes, [photoId]: forPhoto } };
    });
  };

  const credits: string[] = [];
  for (const photo of slides) if (!credits.includes(photo.uploadedBy)) credits.push(photo.uploadedBy);
  const inCount = slides.filter((photo) => {
    const voteMap = post.draft.votes[photo.id] ?? {};
    const ups = Object.values(voteMap).filter((v) => v === "up").length;
    return ups >= threshold;
  }).length;

  const accounts = group.instagramAccounts;
  const selectedAccount = accounts.find((a) => a.id === post.draft.instagramAccountId) ?? accounts[0];
  const handle = selectedAccount?.handle ?? primaryHandle(group);

  const canGoTo = (i: PostStep) => i === 0 || (slides.length > 0 && i <= maxStep + 1);
  const goTo = (i: PostStep) => {
    if (!canGoTo(i)) return;
    setStep(i);
    setMaxStep((m) => (i > m ? i : m));
    topRef.current?.closest("main")?.scrollTo({ top: 0 });
  };
  const stepDone = (i: PostStep) => (i === 2 ? post.posted : i < maxStep && (i !== 0 || slides.length > 0));

  const shareBlocked = !isAdmin
    ? "Only admins can post"
    : !canPost
      ? "Link an Instagram account first"
      : slides.length === 0
        ? "Add at least one photo first"
        : mode === "later" && !Number.isFinite(new Date(scheduleAt).getTime())
          ? "Pick a date and time"
          : "";

  const share = () => {
    setConfirmOpen(false);
    if (shareBlocked) return;
    if (mode === "later") onSchedule(new Date(scheduleAt).getTime());
    else onSetPosted(true);
  };

  return (
    <>
      <div ref={topRef} className={`${styles.home} ${styles.homeFull} ${styles.flowPage}`}>
        <div className={styles.projHead}>
          <div>
            <h1>{post.name}</h1>
            <p>{post.date}</p>
          </div>
          {post.posted ? (
            <span className={`${styles.pill} ${styles.pillOk}`}>
              <Icon name="check" size={11} /> {postedLabel(post.postedAt)}
            </span>
          ) : post.scheduledFor ? (
            <span className={`${styles.pill} ${styles.pillWarn}`}>
              <Icon name="clock" size={11} /> {scheduledLabel(post.scheduledFor)}
            </span>
          ) : null}
          {post.posted && (
            <button className={styles.btnGhost2} onClick={() => onSetPosted(false)}>
              Move back to drafts
            </button>
          )}
        </div>
        {!canPost && !post.posted && (
          <button type="button" className={styles.linkIgHint} onClick={onOpenInstagram}>
            <Icon name="instagram" size={12} /> Link an Instagram account to post
          </button>
        )}

        <StepBar step={step} isDone={stepDone} canGoTo={canGoTo} onGo={goTo} />

        {step === 0 && (
          <>
        <div className={styles.postLayout}>
          <aside className={styles.photosPanel}>
            <div className={styles.panelHead}>
              <div>
                <h3>Photos</h3>
                <span className={styles.hint}>Drag into the carousel</span>
              </div>
              <button className={styles.btnGhost2} onClick={() => fileRef.current?.click()}>
                <Icon name="plus" size={14} /> Add
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) onAddMedia(e.target.files, post.folderId);
                  e.target.value = "";
                }}
              />
            </div>
            {pool.length === 0 ? (
              <p className={styles.emptyTray}>No photos yet. Add some to get started.</p>
            ) : (
              <div className={styles.drawerGrid}>
                {pool.map((photo) => {
                  const included = slideIds.includes(photo.id);
                  return (
                    <button
                      key={photo.id}
                      className={`${styles.trayThumb} ${included ? styles.trayThumbOn : ""}`}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", photo.id)}
                      onClick={() => {
                        if (!included) onDropPhoto(photo.id);
                      }}
                      title={photo.name}
                    >
                      <PhotoThumb photo={photo} />
                      {included && (
                        <span className={styles.trayCheck}>
                          <Icon name="check" size={12} />
                        </span>
                      )}
                      <span className={styles.trayTag}>
                        {photo.uploadedBy}
                        {included ? " · added" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section
            className={styles.carouselPanel}
            onDragOver={(e) => {
              e.preventDefault();
              setSlidesDragOver(true);
            }}
            onDragLeave={() => setSlidesDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setSlidesDragOver(false);
              const id = e.dataTransfer.getData("text/plain");
              if (id) onDropPhoto(id);
            }}
          >
            <div className={styles.carouselHead}>
              <h3>Launch carousel</h3>
              <span className={styles.hint}>
                {slides.length} {slides.length === 1 ? "photo" : "photos"} · {inCount} in
              </span>
            </div>
            <p className={styles.carouselRule}>A photo is in once it has {threshold}+ thumbs up.</p>
            <div className={`${styles.carouselGrid} ${slidesDragOver ? styles.slideDropOver : ""}`}>
              {slides.map((photo) => {
                const voteMap = post.draft.votes[photo.id] ?? {};
                const ups = Object.values(voteMap).filter((v) => v === "up").length;
                const downs = Object.values(voteMap).filter((v) => v === "down").length;
                const isIn = ups >= threshold;
                return (
                  <div
                    key={photo.id}
                    className={`${styles.voteCard} ${dragOverSlideId === photo.id ? styles.voteCardDragOver : ""}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", photo.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverSlideId(photo.id);
                    }}
                    onDragLeave={() => setDragOverSlideId((id) => (id === photo.id ? null : id))}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverSlideId(null);
                      setSlidesDragOver(false);
                      const draggedId = e.dataTransfer.getData("text/plain");
                      if (!draggedId || draggedId === photo.id) return;
                      if (slideIds.includes(draggedId)) moveSlideBefore(draggedId, photo.id);
                      else onDropPhoto(draggedId);
                    }}
                  >
                    <div className={`${styles.voteCardMedia} ${isIn ? styles.voteCardIn : ""}`}>
                      <PhotoThumb photo={photo} />
                      {isIn && <span className={styles.inBadge}>In</span>}
                      <button className={styles.slideRemove} onClick={() => removeSlide(photo.id)} title="Remove">
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                    <div className={styles.voteRow2}>
                      <button
                        className={`${styles.voteBtn2} ${ups > downs ? styles.voteBtn2Up : ""}`}
                        onClick={() => setVote(photo.id, voterKey, "up")}
                        title="You like this photo"
                      >
                        <Icon name="up" size={13} /> {ups}
                      </button>
                      <button
                        className={`${styles.voteBtn2} ${downs > ups ? styles.voteBtn2Down : ""}`}
                        onClick={() => setVote(photo.id, voterKey, "down")}
                        title="You don't like this photo"
                      >
                        <Icon name="down" size={13} /> {downs}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className={styles.dropHere}>Drop photos here</div>
            </div>
          </section>
        </div>

          </>
        )}

        {step === 1 && <DetailsStep group={group} post={post} slides={slides} onUpdateDraft={onUpdateDraft} onOpenInstagram={onOpenInstagram} />}

        {step === 2 && (
          <ReviewStep
            group={group}
            post={post}
            slides={slides}
            handle={handle}
            credits={credits}
            inCount={inCount}
            threshold={threshold}
            mode={mode}
            setMode={setMode}
            scheduleAt={scheduleAt}
            setScheduleAt={setScheduleAt}
            onEdit={goTo}
          />
        )}

        <div className={styles.flowFooter}>
          {step > 0 ? (
            <button type="button" className={styles.btnGhost2} onClick={() => goTo((step - 1) as PostStep)}>
              <Icon name="l" size={14} /> {POST_STEPS[step - 1].label}
            </button>
          ) : (
            <span />
          )}
          <div className={styles.flowFooterRight}>
            {step === 0 && slides.length === 0 && <span className={styles.footerHint}>Add at least one photo to the carousel</span>}
            {step === 2 && !post.posted && shareBlocked && <span className={styles.footerHint}>{shareBlocked}</span>}
            {step < 2 ? (
              <button type="button" className={styles.btnSm} disabled={!canGoTo((step + 1) as PostStep)} onClick={() => goTo((step + 1) as PostStep)}>
                Next: {POST_STEPS[step + 1].label} <Icon name="r" size={14} />
              </button>
            ) : post.posted ? (
              <span className={`${styles.pill} ${styles.pillOk}`}>
                <Icon name="check" size={11} /> Shared to Instagram
              </span>
            ) : (
              <button type="button" className={styles.btnSm} disabled={!!shareBlocked} onClick={() => setConfirmOpen(true)}>
                <Icon name="send" size={14} /> {mode === "later" ? "Schedule post" : "Share"}
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className={styles.overlay} onClick={() => setConfirmOpen(false)}>
          <div className={styles.modal} role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" onClick={(e) => e.stopPropagation()}>
            <h2 id="confirmTitle">{mode === "later" ? `Schedule for ${handle}?` : `Post to ${handle}?`}</h2>
            <p className={styles.confirmText}>
              {mode === "later"
                ? `${post.name} (${slides.length} ${slides.length === 1 ? "photo" : "photos"}) will go live on Instagram ${new Date(scheduleAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`
                : `This shares ${post.name} (${slides.length} ${slides.length === 1 ? "photo" : "photos"}) on Instagram right away. Everyone following the account will see it.`}
            </p>
            <div className={`${styles.modalActions} ${styles.confirmActions}`}>
              <button type="button" className={styles.btnGhost} autoFocus onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={share}>
                {mode === "later" ? "Yes, schedule it" : "Yes, post it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type PostStep = 0 | 1 | 2;

const POST_STEPS: { label: string; sub: string }[] = [
  { label: "Photos", sub: "Upload and vote" },
  { label: "Details", sub: "Caption, audio, tags" },
  { label: "Review", sub: "Check and share" },
];

function StepBar({
  step,
  isDone,
  canGoTo,
  onGo,
}: {
  step: PostStep;
  isDone: (i: PostStep) => boolean;
  canGoTo: (i: PostStep) => boolean;
  onGo: (i: PostStep) => void;
}) {
  return (
    <ol className={styles.stepBar} aria-label="Post steps">
      {POST_STEPS.map((s, idx) => {
        const i = idx as PostStep;
        const done = isDone(i);
        const on = step === i;
        return (
          <li key={s.label} className={styles.stepCell}>
            <button
              type="button"
              className={`${styles.stepItem} ${on ? styles.stepItemOn : ""} ${done && !on ? styles.stepItemDone : ""}`}
              disabled={!canGoTo(i)}
              aria-current={on ? "step" : undefined}
              onClick={() => onGo(i)}
            >
              <span className={styles.stepNum}>{done && !on ? <Icon name="check" size={14} /> : idx + 1}</span>
              <span className={styles.stepText}>
                <b>{s.label}</b>
                <small>{done && !on ? "Done" : s.sub}</small>
              </span>
            </button>
            {idx < POST_STEPS.length - 1 && <span className={`${styles.stepLine} ${done ? styles.stepLineDone : ""}`} />}
          </li>
        );
      })}
    </ol>
  );
}

const SUGGESTED_AUDIO = ["Golden Hour · JVKE", "Good Days · SZA", "Sunday Best · Surfaces", "Island in the Sun · Weezer", "Electric Feel · MGMT"];

function DetailsStep({
  group,
  post,
  slides,
  onUpdateDraft,
  onOpenInstagram,
}: {
  group: Group;
  post: PostCard;
  slides: Photo[];
  onUpdateDraft: (fn: (draft: Draft) => Draft) => void;
  onOpenInstagram: () => void;
}) {
  const [audioQuery, setAudioQuery] = useState("");
  const [personInput, setPersonInput] = useState("");
  const [productInput, setProductInput] = useState("");
  const d = post.draft;
  const set = (patch: Partial<Draft>) => onUpdateDraft((draft) => ({ ...draft, ...patch }));

  const tagged = d.taggedPeople ?? [];
  const products = d.taggedProducts ?? [];
  const accounts = group.instagramAccounts;
  const account = accounts.find((a) => a.id === d.instagramAccountId) ?? accounts[0];
  const locationIdeas = [group.name, "Lawrence, Kansas", "University of Kansas", "Massachusetts Street"].filter((l) => l !== d.location);
  const audioMatches = audioQuery.trim()
    ? SUGGESTED_AUDIO.filter((a) => a.toLowerCase().includes(audioQuery.trim().toLowerCase()))
    : SUGGESTED_AUDIO;

  const addPerson = (raw: string) => {
    const h = normalizeHandle(raw);
    if (!h || tagged.includes(h)) return;
    set({ taggedPeople: [...tagged, h] });
  };
  const removePerson = (h: string) => set({ taggedPeople: tagged.filter((x) => x !== h) });
  const addProduct = (raw: string) => {
    const p = raw.trim();
    if (!p || products.includes(p)) return;
    set({ taggedProducts: [...products, p] });
  };
  const teamHandles = new Set(group.members.map((m) => normalizeHandle(m.username || m.name)));
  const otherTagged = tagged.filter((h) => !teamHandles.has(h));

  return (
    <div className={styles.detailsGrid}>
      {/* ---- Caption & audio ---- */}
      <section className={styles.dCard}>
        <div className={styles.dCardHead}>
          <h3>Caption &amp; audio</h3>
          <span className={styles.hint}>
            {slides.length} {slides.length === 1 ? "photo" : "photos"}
          </span>
        </div>
        <div className={styles.thumbStrip}>
          {slides.map((p) => (
            <span key={p.id} className={styles.thumbStripItem}>
              <PhotoThumb photo={p} />
            </span>
          ))}
        </div>

        <div className={styles.field}>
          <label htmlFor="dcaption">Caption</label>
          <textarea
            id="dcaption"
            className={`${styles.captionBox} ${styles.captionTall}`}
            value={d.caption}
            onChange={(e) => set({ caption: e.target.value })}
            placeholder="Write a caption. Tag people and brands with @."
          />
          <span className={styles.fieldCount}>{d.caption.length} / 2,200</span>
        </div>

        <div className={styles.field}>
          <label htmlFor="daudio">
            <Icon name="music" size={13} /> Audio <span className={styles.fieldNote}>(optional)</span>
          </label>
          {d.audio ? (
            <div className={styles.picked}>
              <Icon name="music" size={14} />
              <span>{d.audio}</span>
              <button type="button" className={styles.iconClose} onClick={() => set({ audio: undefined })} title="Remove audio">
                <Icon name="x" size={13} />
              </button>
            </div>
          ) : (
            <>
              <input id="daudio" className={styles.input} value={audioQuery} onChange={(e) => setAudioQuery(e.target.value)} placeholder="Search music" />
              <div className={styles.chipRow}>
                {audioMatches.map((a) => (
                  <button key={a} type="button" className={styles.pchip} onClick={() => set({ audio: a })}>
                    {a}
                  </button>
                ))}
                {audioMatches.length === 0 && <span className={styles.hint}>No songs match “{audioQuery}”.</span>}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ---- Tags & location ---- */}
      <section className={styles.dCard}>
        <div className={styles.dCardHead}>
          <h3>Tags &amp; location</h3>
        </div>

        <div className={styles.field}>
          <label>
            <Icon name="user" size={13} /> Tag people
          </label>
          <div className={styles.chipRow}>
            {group.members.map((m) => {
              const h = normalizeHandle(m.username || m.name);
              const on = tagged.includes(h);
              return (
                <button key={m.id} type="button" className={`${styles.pchip} ${on ? styles.pchipOn : ""}`} aria-pressed={on} onClick={() => (on ? removePerson(h) : addPerson(h))}>
                  {on && <Icon name="check" size={12} />} {m.name}
                </button>
              );
            })}
            {otherTagged.map((h) => (
              <button key={h} type="button" className={`${styles.pchip} ${styles.pchipOn}`} onClick={() => removePerson(h)} title="Remove tag">
                {h} <Icon name="x" size={11} />
              </button>
            ))}
          </div>
          <form
            className={styles.inlineAdd}
            onSubmit={(e) => {
              e.preventDefault();
              addPerson(personInput);
              setPersonInput("");
            }}
          >
            <input className={styles.input} value={personInput} onChange={(e) => setPersonInput(e.target.value)} placeholder="Tag someone else, e.g. @username" aria-label="Tag someone else" />
            <button type="submit" className={styles.btnGhost2} disabled={!personInput.trim()}>
              Tag
            </button>
          </form>
        </div>

        <div className={styles.field}>
          <label>
            <Icon name="bag" size={13} /> Tag products <span className={styles.fieldNote}>(optional)</span>
          </label>
          <form
            className={styles.inlineAdd}
            onSubmit={(e) => {
              e.preventDefault();
              addProduct(productInput);
              setProductInput("");
            }}
          >
            <input className={styles.input} value={productInput} onChange={(e) => setProductInput(e.target.value)} placeholder="Product name" aria-label="Product name" />
            <button type="submit" className={styles.btnGhost2} disabled={!productInput.trim()}>
              Add
            </button>
          </form>
          {products.length > 0 && (
            <div className={styles.chipRow}>
              {products.map((p) => (
                <button key={p} type="button" className={`${styles.pchip} ${styles.pchipOn}`} onClick={() => set({ taggedProducts: products.filter((x) => x !== p) })} title="Remove">
                  {p} <Icon name="x" size={11} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="dlocation">
            <Icon name="pin" size={13} /> Location <span className={styles.fieldNote}>(optional)</span>
          </label>
          <input id="dlocation" className={styles.input} value={d.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder="Add location" />
          {!d.location && (
            <div className={styles.chipRow}>
              {locationIdeas.map((l) => (
                <button key={l} type="button" className={styles.pchip} onClick={() => set({ location: l })}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <span className={styles.fieldHelp}>Anyone who sees the post can see this location.</span>
        </div>
      </section>

      {/* ---- Sharing settings ---- */}
      <section className={styles.dCard}>
        <div className={styles.dCardHead}>
          <h3>Sharing</h3>
        </div>

        <div className={styles.field}>
          <label htmlFor="daccount">
            <Icon name="instagram" size={13} /> Post to
          </label>
          {accounts.length === 0 ? (
            <button type="button" className={styles.linkIgHint} onClick={onOpenInstagram}>
              <Icon name="instagram" size={12} /> Link an Instagram account to post
            </button>
          ) : (
            <select id="daccount" className={styles.input} value={account?.id ?? ""} onChange={(e) => set({ instagramAccountId: e.target.value })}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.handle}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={styles.field}>
          <label>
            <Icon name="eye" size={13} /> Audience
          </label>
          <div className={`${styles.roleToggle} ${styles.toggleFull}`}>
            <button type="button" className={`${styles.roleBtn} ${d.audience !== "close" ? styles.roleBtnOn : ""}`} onClick={() => set({ audience: "everyone" })}>
              Everyone
            </button>
            <button type="button" className={`${styles.roleBtn} ${d.audience === "close" ? styles.roleBtnOn : ""}`} onClick={() => set({ audience: "close" })}>
              Close friends
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label>
            <Icon name="share" size={13} /> Also share on
          </label>
          <label className={styles.switchRow}>
            <span>Facebook</span>
            <input type="checkbox" className={styles.switch} checked={!!d.shareFacebook} onChange={(e) => set({ shareFacebook: e.target.checked })} />
          </label>
          <label className={styles.switchRow}>
            <span>Threads</span>
            <input type="checkbox" className={styles.switch} checked={!!d.shareThreads} onChange={(e) => set({ shareThreads: e.target.checked })} />
          </label>
        </div>

        <div className={styles.field}>
          <label>
            <Icon name="sliders" size={13} /> More options
          </label>
          <label className={styles.switchRow}>
            <span>Hide like count</span>
            <input type="checkbox" className={styles.switch} checked={!!d.hideLikeCount} onChange={(e) => set({ hideLikeCount: e.target.checked })} />
          </label>
          <label className={styles.switchRow}>
            <span>Turn off commenting</span>
            <input type="checkbox" className={styles.switch} checked={!!d.commentsOff} onChange={(e) => set({ commentsOff: e.target.checked })} />
          </label>
          <label className={styles.switchRow}>
            <span>
              Add AI label
              <small>Required for realistic photos made with AI</small>
            </span>
            <input type="checkbox" className={styles.switch} checked={!!d.aiLabel} onChange={(e) => set({ aiLabel: e.target.checked })} />
          </label>
        </div>
      </section>
    </div>
  );
}

function ReviewStep({
  group,
  post,
  slides,
  handle,
  credits,
  inCount,
  threshold,
  mode,
  setMode,
  scheduleAt,
  setScheduleAt,
  onEdit,
}: {
  group: Group;
  post: PostCard;
  slides: Photo[];
  handle: string;
  credits: string[];
  inCount: number;
  threshold: number;
  mode: "now" | "later";
  setMode: (m: "now" | "later") => void;
  scheduleAt: string;
  setScheduleAt: (v: string) => void;
  onEdit: (step: PostStep) => void;
}) {
  const d = post.draft;
  const tagged = d.taggedPeople ?? [];
  const products = d.taggedProducts ?? [];
  const shareOn = [d.shareFacebook && "Facebook", d.shareThreads && "Threads"].filter(Boolean).join(", ");
  const extras = [d.hideLikeCount && "Like count hidden", d.commentsOff && "Comments off", d.aiLabel && "AI label"].filter(Boolean).join(" · ");

  const Item = ({ label, value, empty, to }: { label: string; value?: string; empty: string; to: PostStep }) => (
    <div className={styles.sumRow}>
      <span className={styles.sumLabel}>{label}</span>
      <span className={value ? styles.sumValue : `${styles.sumValue} ${styles.sumEmpty}`}>{value || empty}</span>
      {!post.posted && (
        <button type="button" className={styles.linkBtn} onClick={() => onEdit(to)}>
          Edit
        </button>
      )}
    </div>
  );

  return (
    <div className={styles.reviewLayout}>
      <div className={styles.reviewPhone}>
        <InstagramPreviewCard group={group} post={post} slides={slides} handle={handle} />
      </div>
      <div className={styles.reviewSummary}>
        <h3>Everything look right?</h3>
        <p className={styles.hint}>This is exactly what will go out. Fix anything here before you share.</p>
        <div className={styles.sumList}>
          <Item
            label="Photos"
            value={`${slides.length} ${slides.length === 1 ? "photo" : "photos"} · ${inCount} with ${threshold}+ thumbs up`}
            empty="No photos yet"
            to={0}
          />
          <Item label="Caption" value={d.caption.trim() ? d.caption : undefined} empty="No caption" to={1} />
          <Item label="Audio" value={d.audio} empty="No audio" to={1} />
          <Item label="Tagged" value={tagged.join(", ")} empty="No one tagged" to={1} />
          <Item label="Products" value={products.join(", ")} empty="None" to={1} />
          <Item label="Location" value={d.location} empty="No location" to={1} />
          <Item label="Post to" value={handle} empty="Not linked" to={1} />
          <Item label="Audience" value={d.audience === "close" ? "Close friends" : "Everyone"} empty="" to={1} />
          <Item label="Also share on" value={shareOn} empty="Off" to={1} />
          <Item label="Settings" value={extras} empty="Defaults" to={1} />
          <div className={styles.sumRow}>
            <span className={styles.sumLabel}>Credits</span>
            <span className={styles.sumValue}>{credits.length ? credits.map((c) => `Shot by ${c}`).join(" · ") : "—"}</span>
          </div>
        </div>

        {!post.posted && (
          <div className={styles.field}>
            <label>When</label>
            <div className={styles.roleToggle}>
              <button type="button" className={`${styles.roleBtn} ${mode === "now" ? styles.roleBtnOn : ""}`} onClick={() => setMode("now")}>
                Post now
              </button>
              <button type="button" className={`${styles.roleBtn} ${mode === "later" ? styles.roleBtnOn : ""}`} onClick={() => setMode("later")}>
                Schedule
              </button>
            </div>
            {mode === "later" && <input type="datetime-local" className={styles.input} value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />}
          </div>
        )}
      </div>
    </div>
  );
}

function InstagramPreviewCard({ group, post, slides, handle: handleIn }: { group: Group; post: PostCard; slides: Photo[]; handle?: string }) {
  const [pvIndex, setPvIndex] = useState(0);
  const activeIndex = Math.min(pvIndex, Math.max(0, slides.length - 1));
  const handle = (handleIn ?? primaryHandle(group)).replace(/^@/, "");
  const d = post.draft;
  const sub = [d.location, d.audio && `♪ ${d.audio}`].filter(Boolean) as string[];

  return (
    <div className={styles.pvCard}>
      <div className={styles.pvHead}>
        <span className={styles.groupIcon} style={{ "--c": group.color, width: "30px", height: "30px", borderRadius: "50%", fontSize: "11px" } as CSSProperties}>
          {initials(group.name)}
        </span>
        <span className={styles.pvWho}>
          <b>{handle}</b>
          {sub.map((s) => (
            <small key={s}>{s}</small>
          ))}
        </span>
      </div>
      <div className={styles.pvImage}>
        {slides.length === 0 ? (
          <PhotoThumb photo={null} />
        ) : (
          <>
            <PhotoThumb photo={slides[activeIndex]} />
            {(d.taggedPeople?.length ?? 0) > 0 && (
              <span className={styles.pvTag} title={d.taggedPeople!.join(", ")}>
                <Icon name="user" size={12} />
              </span>
            )}
            {slides.length > 1 && (
              <>
                <span className={styles.pvCount}>
                  {activeIndex + 1}/{slides.length}
                </span>
                <button className={`${styles.pvNav} ${styles.pvNavL}`} disabled={activeIndex === 0} onClick={() => setPvIndex((i) => Math.max(0, i - 1))}>
                  <Icon name="l" size={14} />
                </button>
                <button
                  className={`${styles.pvNav} ${styles.pvNavR}`}
                  disabled={activeIndex === slides.length - 1}
                  onClick={() => setPvIndex((i) => Math.min(slides.length - 1, i + 1))}
                >
                  <Icon name="r" size={14} />
                </button>
                <div className={styles.pvDots}>
                  {slides.map((_, i) => (
                    <i key={i} className={i === activeIndex ? styles.pvDotOn : styles.pvDot} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
      <div className={styles.pvIcons}>
        <Icon name="heart" size={22} />
        {!d.commentsOff && <Icon name="comment" size={22} />}
        <Icon name="send" size={22} />
      </div>
      {!d.hideLikeCount && <div className={styles.pvLikes}>Be the first to like this</div>}
      <div className={styles.pvCaption}>
        <b>{handle}</b> {d.caption || <span className={styles.hint}>No caption yet</span>}
      </div>
      {d.aiLabel && <div className={styles.pvLocation}>AI info</div>}
    </div>
  );
}
function MediaPage({
  group,
  onAddMedia,
  onCreateFolder,
  onDeleteFolder,
  onMoveToFolder,
  onAddToPost,
}: {
  group: Group;
  onAddMedia: (files: FileList, folderId?: string | null) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveToFolder: (photoId: string, folderId: string | null) => void;
  onAddToPost: (postId: string, photoId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeFolder, setActiveFolder] = useState("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [folderDragOver, setFolderDragOver] = useState<string | null>(null);
  const [postDragOver, setPostDragOver] = useState<string | null>(null);

  const pool = groupMediaPool(group);
  const shown = activeFolder === "all" ? pool : activeFolder === "unsorted" ? pool.filter((p) => !p.folderId) : pool.filter((p) => p.folderId === activeFolder);
  const notPosted = group.posts.filter((p) => !p.posted);

  const submitFolder = (e: FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim());
    setNewFolderName("");
  };

  const uploadFolderId = activeFolder === "all" || activeFolder === "unsorted" ? null : activeFolder;

  return (
    <div className={styles.home}>
      <h1>{group.name} · Media</h1>
      <p>
        {pool.length} {pool.length === 1 ? "photo" : "photos"}
      </p>

      {notPosted.length > 0 && (
        <div className={styles.addToPostRow}>
          <span className={styles.chipLabel}>Drag a photo onto a post below to add it</span>
          <div className={styles.addToPostList}>
            {notPosted.map((post) => (
              <div
                key={post.id}
                className={`${styles.addToPostChip} ${postDragOver === post.id ? styles.addToPostChipOver : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setPostDragOver(post.id);
                }}
                onDragLeave={() => setPostDragOver((id) => (id === post.id ? null : id))}
                onDrop={(e) => {
                  e.preventDefault();
                  setPostDragOver(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) onAddToPost(post.id, id);
                }}
              >
                <Icon name="folder" size={13} /> {post.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.mediaLayout}>
        <aside className={styles.folderList}>
          <button className={`${styles.folderRow} ${activeFolder === "all" ? styles.folderRowOn : ""}`} onClick={() => setActiveFolder("all")}>
            <Icon name="layers" size={14} />
            <span className={styles.folderRowName}>All media</span>
            <span className={styles.hint}>{pool.length}</span>
          </button>
          <button
            className={`${styles.folderRow} ${activeFolder === "unsorted" ? styles.folderRowOn : ""} ${folderDragOver === "unsorted" ? styles.folderRowDrop : ""}`}
            onClick={() => setActiveFolder("unsorted")}
            onDragOver={(e) => {
              e.preventDefault();
              setFolderDragOver("unsorted");
            }}
            onDragLeave={() => setFolderDragOver((f) => (f === "unsorted" ? null : f))}
            onDrop={(e) => {
              e.preventDefault();
              setFolderDragOver(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) onMoveToFolder(id, null);
            }}
          >
            <Icon name="image" size={14} />
            <span className={styles.folderRowName}>Unsorted</span>
            <span className={styles.hint}>{pool.filter((p) => !p.folderId).length}</span>
          </button>
          {group.folders.map((folder) => (
            <button
              key={folder.id}
              className={`${styles.folderRow} ${activeFolder === folder.id ? styles.folderRowOn : ""} ${folderDragOver === folder.id ? styles.folderRowDrop : ""}`}
              onClick={() => setActiveFolder(folder.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setFolderDragOver(folder.id);
              }}
              onDragLeave={() => setFolderDragOver((f) => (f === folder.id ? null : f))}
              onDrop={(e) => {
                e.preventDefault();
                setFolderDragOver(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) onMoveToFolder(id, folder.id);
              }}
            >
              <Icon name="folder" size={14} />
              <span className={styles.folderRowName}>{folder.name}</span>
              <span className={styles.hint}>{pool.filter((p) => p.folderId === folder.id).length}</span>
              <span
                role="button"
                tabIndex={0}
                className={styles.folderDelete}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(folder.id);
                }}
                title="Delete folder"
              >
                <Icon name="x" size={12} />
              </span>
            </button>
          ))}
          <form className={styles.newFolderRow} onSubmit={submitFolder}>
            <input className={styles.input} value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder" />
            <button type="submit" className={styles.iconClose} title="Create folder" disabled={!newFolderName.trim()}>
              <Icon name="plus" size={14} />
            </button>
          </form>
        </aside>

        <div className={styles.mediaMain}>
          <div className={styles.panelHead}>
            <span className={styles.hint}>Drag a photo onto a folder on the left to sort it</span>
            <button className={styles.btnGhost2} onClick={() => fileRef.current?.click()}>
              <Icon name="plus" size={14} /> Add photos
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) onAddMedia(e.target.files, uploadFolderId);
                e.target.value = "";
              }}
            />
          </div>
          {shown.length === 0 ? (
            <p className={styles.emptyTray}>No photos here yet.</p>
          ) : (
            <div className={styles.drawerGrid}>
              {shown.map((photo) => (
                <div
                  key={photo.id}
                  className={styles.trayThumb}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", photo.id)}
                  title={photo.name}
                >
                  <PhotoThumb photo={photo} />
                  <span className={styles.trayTag}>{photo.uploadedBy}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
