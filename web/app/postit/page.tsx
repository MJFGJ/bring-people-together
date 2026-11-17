"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
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
}

interface PostCard {
  id: string;
  name: string;
  date: string;
  drafts: number;
  ready: number;
  pending: number;
  draft: Draft;
  posted: boolean;
  postedAt: number | null;
  requested: boolean;
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
  activity: ActivityItem[];
}

function primaryHandle(group: Group): string {
  return group.instagramAccounts[0]?.handle ?? "Not linked";
}

function makeSeedPhotos(count: number, members: string[], startAgoMin: number): Photo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `seed-${startAgoMin}-${i}`,
    name: `IMG_${1000 + i}.jpg`,
    url: null,
    tone: (i * 37 + 20) % 80 + 10,
    uploadedBy: members.length ? byId(members[i % members.length]).name : "Team",
    at: Date.now() - (startAgoMin - i) * 60000,
    folderId: null,
  }));
}

const GROUP_COLORS = ["#E4572E", "#2F6FEB", "#13A06B", "#8B5CF6", "#E3A008", "#D2433F", "#0E9F9F"];

function makeInitialGroups(): Group[] {
  const lookbookPhotos = makeSeedPhotos(13, ["jordan", "lena", "maya"], 70);
  const cafePhotos = makeSeedPhotos(9, ["maya", "sam"], 48);
  const btsPhotos = makeSeedPhotos(6, ["sam", "lena", "jordan"], 30);
  return [
    {
      id: "ribbonclub",
      name: "Ribbon Club",
      color: "#E4572E",
      members: [memberFromPerson("jordan", "admin"), memberFromPerson("lena", "member"), memberFromPerson("maya", "member")],
      instagramAccounts: [{ id: "ig-ribbonclub", handle: "@ribbonclub" }],
      media: lookbookPhotos,
      folders: [],
      posts: [
        {
          id: "p1",
          name: "Lookbook Shoot",
          date: "Shot Nov 8",
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
          requested: false,
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
      folders: [],
      posts: [
        {
          id: "p2",
          name: "Café Opening",
          date: "Shot Nov 2",
          drafts: 1,
          ready: 1,
          pending: 0,
          draft: { slideIds: [cafePhotos[1].id], caption: "We're open! First latte is on us this weekend.", votes: { [cafePhotos[1].id]: { maya: "up", sam: "up" } } },
          posted: true,
          postedAt: Date.now() - 2 * 24 * 60 * 60000,
          requested: false,
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
      folders: [],
      posts: [
        {
          id: "p3",
          name: "Studio BTS",
          date: "Ongoing",
          drafts: 0,
          ready: 0,
          pending: 0,
          draft: { slideIds: [], caption: "", votes: {} },
          posted: false,
          postedAt: null,
          requested: false,
        },
      ],
      chat: [],
      activity: [{ id: "a1", at: Date.now() - 20 * 60000, actorName: "Sam Okafor", color: "#13A06B", fg: "#fff", verb: "created the post", target: "Studio BTS", icon: "folder" }],
    },
  ];
}

function revokeBlobUrls(groups: Group[]) {
  for (const g of groups) for (const ph of g.media) if (ph.url?.startsWith("blob:")) URL.revokeObjectURL(ph.url);
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
  name: string;
  email: string;
  username: string;
  instagram?: string;
  color: string;
}

type Stage = "signup" | "connectInstagram" | "groups" | "app";
type Screen = "posts" | "post" | "posted" | "media" | "activity";

let toastId = 0;

const CANNED_REPLIES = [
  "On it!",
  "Looks good to me 👍",
  "Can someone grab a few more shots of this?",
  "+1",
  "Let's go with this one for the caption.",
  "I'll upload what I have in a bit.",
  "Great, thanks for the update!",
];

export default function PostitPage() {
  const [stage, setStage] = useState<Stage>("signup");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [groups, setGroups] = useState<Group[]>(makeInitialGroups);
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
    const stored = window.localStorage.getItem("postit-live-cursors");
    if (stored !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveCursors(stored !== "0");
    }
  }, []);

  const toggleLiveCursors = () => {
    setLiveCursors((v) => {
      const next = !v;
      window.localStorage.setItem("postit-live-cursors", next ? "1" : "0");
      return next;
    });
  };

  const pushToast = (text: string) => {
    const id = ++toastId;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  const updateGroup = (id: string, fn: (g: Group) => Group) => setGroups((gs) => gs.map((g) => (g.id === id ? fn(g) : g)));

  const pushActivity = (groupId: string, entry: Omit<ActivityItem, "id" | "at">) => {
    updateGroup(groupId, (g) => ({
      ...g,
      activity: [{ ...entry, id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now() }, ...g.activity],
    }));
  };

  const handleSignUp = (name: string, email: string, username: string) => {
    setUser({ name, email, username: normalizeHandle(username) || `@${slugify(name)}`, color: hashColor(email || name) });
    setStage("connectInstagram");
  };

  const handleFinishOnboarding = (instagram?: string) => {
    setUser((u) => (u ? { ...u, instagram } : u));
    setStage("groups");
    pushToast(instagram ? `Linked <em>${instagram}</em>. Pick a group to get started.` : "Pick a group to get started.");
  };

  const ensureMembership = (groupId: string) => {
    if (!user) return;
    setGroups((gs) =>
      gs.map((g) => {
        if (g.id !== groupId) return g;
        if (g.members.some((m) => m.email && m.email === user.email)) return g;
        const me: Member = { id: `me-${slugify(user.email || user.name)}`, name: user.name, email: user.email, username: user.username, role: "member", color: user.color, fg: "#fff" };
        return { ...g, members: [...g.members, me] };
      })
    );
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
    const me: Member = { id: `me-${slugify(user.email || user.name)}`, name: user.name, email: user.email, username: user.username, role: "admin", color: user.color, fg: "#fff" };
    const members = [me, ...invitees];
    const group: Group = { id, name, color, members, instagramAccounts, media: [], folders: [], posts: [], chat: [], activity: [] };
    setGroups((g) => [...g, group]);
    setActiveGroupId(id);
    setScreen("posts");
    setActivePostId(null);
    setStage("app");
    setCreatingGroup(false);
    for (const m of invitees) {
      pushActivity(id, { actorName: user.name, color: user.color, fg: "#fff", verb: `invited ${m.name} as ${m.role === "admin" ? "an admin" : "a team member"} to`, target: name, icon: "plus" });
    }
    if (instagramAccounts.length) {
      pushActivity(id, { actorName: user.name, color: user.color, fg: "#fff", verb: `linked ${instagramAccounts.map((a) => a.handle).join(", ")} to`, target: name, icon: "instagram" });
    }
    pushToast(
      `Created <em>${name}</em>${invitees.length ? ` with ${invitees.length} teammate${invitees.length === 1 ? "" : "s"}` : ""}.${
        instagramAccounts.length ? "" : " Link an Instagram account before you post."
      }`
    );
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
    const date = when.trim() || `Added ${formatToday()}`;
    const post: PostCard = {
      id,
      name,
      date,
      drafts: 0,
      ready: 0,
      pending: 0,
      draft: { slideIds: [], caption: "", votes: {} },
      posted: false,
      postedAt: null,
      requested: false,
    };
    updateGroup(activeGroupId, (g) => ({ ...g, posts: [...g.posts, post] }));
    pushActivity(activeGroupId, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: "created the post", target: name, icon: "folder" });
    setActivePostId(id);
    setScreen("post");
    setCreatingPost(false);
    pushToast(`Created <em>${name}</em>. Add some photos to get started.`);
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
      posts: g.posts.map((p) => (p.id === postId ? { ...p, posted, postedAt: posted ? Date.now() : null, requested: false } : p)),
    }));
    pushActivity(activeGroupId, {
      actorName: user?.name ?? "You",
      color: user?.color ?? "#888",
      fg: "#fff",
      verb: posted ? `marked ${postName} as posted` : `moved ${postName} back to drafts`,
      icon: posted ? "check" : "folder",
    });
  };

  const handleRequestPost = (postId: string, postName: string) => {
    if (!activeGroupId) return;
    updateGroup(activeGroupId, (g) => ({
      ...g,
      posts: g.posts.map((p) => (p.id === postId ? { ...p, requested: true } : p)),
    }));
    pushActivity(activeGroupId, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: "asked an admin to approve", target: postName, icon: "check" });
    pushToast(`Asked an admin to approve <em>${postName}</em>.`);
  };

  const handleDropPhotoOnPost = (postId: string, photoId: string) => {
    handleUpdateDraft(postId, (draft) => (draft.slideIds.includes(photoId) ? draft : { ...draft, slideIds: [...draft.slideIds, photoId] }));
  };

  const handleSendChat = (groupId: string, text: string) => {
    if (!user || !text.trim()) return;
    const msg: ChatMessage = { id: `msg-${Date.now()}`, at: Date.now(), authorId: "me", authorName: user.name, color: user.color, fg: "#fff", text: text.trim() };
    updateGroup(groupId, (g) => ({ ...g, chat: [...g.chat, msg] }));
    const members = groups.find((g) => g.id === groupId)?.members ?? [];
    if (members.length > 0) {
      const replier = members[Math.floor(Math.random() * members.length)];
      const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
      setTimeout(() => {
        updateGroup(groupId, (g) => ({
          ...g,
          chat: [...g.chat, { id: `msg-${Date.now()}-r`, at: Date.now(), authorId: replier.id, authorName: replier.name, color: replier.color, fg: replier.fg, text: reply }],
        }));
      }, 900 + Math.random() * 900);
    }
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
    revokeBlobUrls(groups);
    setStage("signup");
    setUser(null);
    setActiveGroupId(null);
    setScreen("posts");
    setActivePostId(null);
    setGroups(makeInitialGroups());
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
        <GroupPicker user={user} groups={groups} onSelect={handleSelectGroup} onCreate={() => setCreatingGroup(true)} onSignOut={handleSignOut} />
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
          onRequestPost={handleRequestPost}
          onDropPhotoOnPost={handleDropPhotoOnPost}
          onSendChat={(text) => handleSendChat(activeGroup.id, text)}
        />
      )}

      {creatingGroup && <CreateGroupModal allGroups={groups} onCreate={handleCreateGroup} onCancel={() => setCreatingGroup(false)} />}
      {creatingPost && <CreatePostModal onCreate={handleCreatePost} onCancel={() => setCreatingPost(false)} />}
      {invitingTeam && activeGroup && (
        <InviteModal group={activeGroup} allGroups={groups} onSave={(members) => handleSaveMembers(activeGroup.id, members)} onCancel={() => setInvitingTeam(false)} />
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
  const [password, setPassword] = useState("");

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && username.trim().length > 0 && password.length > 0;

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
        <h2>Create your account</h2>
        <p className={styles.sub}>Set up your profile. Linking Instagram comes next, but it&rsquo;s optional — handy if your team uses postit at work.</p>
        <div className={styles.field}>
          <label htmlFor="name">Name</label>
          <input id="name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Rivera" autoComplete="name" />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
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
          <label htmlFor="username">Username</label>
          <input id="username" className={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@jamie.rivera" autoComplete="username" />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
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
}: {
  user: CurrentUser;
  groups: Group[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSignOut: () => void;
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
          Signed in as {user.name} · {user.email} ·{" "}
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
          {groups.map((g) => (
            <button key={g.id} className={styles.groupCard} onClick={() => onSelect(g.id)}>
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
          ))}
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
}: {
  drafts: DraftMember[];
  setDrafts: (fn: (d: DraftMember[]) => DraftMember[]) => void;
  allGroups: Group[];
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
          <button type="button" className={styles.iconClose} onClick={() => removeRow(d.key)} title="Remove">
            <Icon name="x" size={14} />
          </button>
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
  onSave,
  onCancel,
}: {
  group: Group;
  allGroups: Group[];
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
        <TeamEditor drafts={drafts} setDrafts={setDrafts} allGroups={allGroups} />
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
  onRequestPost,
  onDropPhotoOnPost,
  onSendChat,
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
  onRequestPost: (postId: string, postName: string) => void;
  onDropPhotoOnPost: (postId: string, photoId: string) => void;
  onSendChat: (text: string) => void;
}) {
  const members = group.members;
  const first = user.name.trim().split(/\s+/)[0] || user.name;
  const activePost = group.posts.find((p) => p.id === activePostId) ?? null;
  const isAdmin = group.members.find((m) => (m.email && m.email === user.email) || (m.username && m.username === user.username))?.role === "admin";
  const canPost = group.instagramAccounts.length > 0;

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
              <small>{user.email}</small>
            </span>
            <Icon name="chev" size={14} />
          </button>
          {menuOpen && (
            <div className={styles.menu}>
              <div className={styles.mh}>{user.name}</div>
              <button onClick={onSwitchGroup}>Switch group</button>
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
            <PostsGrid group={group} members={members} view="active" onOpenPost={onOpenPost} onNewPost={onNewPost} onDropPhoto={onDropPhotoOnPost} />
          )}
          {screen === "posted" && (
            <PostsGrid group={group} members={members} view="posted" onOpenPost={onOpenPost} onNewPost={onNewPost} onDropPhoto={onDropPhotoOnPost} />
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
              group={group}
              post={activePost}
              me={user}
              isAdmin={isAdmin}
              canPost={canPost}
              liveCursors={liveCursors}
              onToggleLiveCursors={onToggleLiveCursors}
              onAddMedia={onAddMedia}
              onUpdateDraft={(fn) => onUpdateDraft(activePost.id, fn)}
              onSetPosted={(posted) => onSetPosted(activePost.id, posted)}
              onRequestPost={() => onRequestPost(activePost.id, activePost.name)}
              onDropPhoto={(photoId) => onDropPhotoOnPost(activePost.id, photoId)}
              onOpenInstagram={onOpenInstagram}
            />
          )}
        </main>
      </div>

      <ChatBubble key={group.id} group={group} onSend={onSendChat} />
    </div>
  );
}

function ChatBubble({ group, onSend }: { group: Group; onSend: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(group.chat.length);
  const [text, setText] = useState("");

  if (open && seenCount !== group.chat.length) {
    setSeenCount(group.chat.length);
  }

  const unread = open ? 0 : Math.max(0, group.chat.length - seenCount);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) setSeenCount(group.chat.length);
      return next;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <div className={styles.chatWidget}>
      {open && (
        <div className={styles.chatPopup}>
          <div className={styles.chatPopupHead}>
            <b>{group.name} chat</b>
            <button className={styles.iconClose} onClick={() => setOpen(false)} title="Close">
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className={styles.chatPopupList}>
            {group.chat.length === 0 ? (
              <p className={styles.hint}>No messages yet. Say hello.</p>
            ) : (
              group.chat.map((m) => (
                <div key={m.id} className={styles.chatPopupMsg}>
                  <Avatar name={m.authorName} color={m.color} fg={m.fg} size="sm" />
                  <div className={styles.chatPopupBody}>
                    <div className={styles.chatPopupMeta}>
                      <b>{m.authorId === "me" ? "You" : m.authorName}</b>
                      <span className={styles.hint}>{timeAgo(m.at)}</span>
                    </div>
                    <p>{m.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <form className={styles.chatPopupInputRow} onSubmit={submit}>
            <input className={styles.input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the group…" />
            <button type="submit" className={styles.btnSm} disabled={!text.trim()}>
              <Icon name="send" size={14} />
            </button>
          </form>
        </div>
      )}
      <button className={styles.chatFab} onClick={toggle} title="Chat">
        <Icon name={open ? "x" : "chat"} size={22} />
        {unread > 0 && <span className={styles.chatBadge}>{unread}</span>}
      </button>
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

function PostsGrid({
  group,
  members,
  view,
  onOpenPost,
  onNewPost,
  onDropPhoto,
}: {
  group: Group;
  members: Member[];
  view: "active" | "posted";
  onOpenPost: (id: string) => void;
  onNewPost: () => void;
  onDropPhoto: (postId: string, photoId: string) => void;
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
              <button
                key={post.id}
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
                    ) : (
                      <>
                        {post.requested && <span className={`${styles.pill} ${styles.pillWarn}`}>Requested</span>}
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
  liveCursors,
  onToggleLiveCursors,
  onAddMedia,
  onUpdateDraft,
  onSetPosted,
  onRequestPost,
  onDropPhoto,
  onOpenInstagram,
}: {
  group: Group;
  post: PostCard;
  me: CurrentUser;
  isAdmin: boolean;
  canPost: boolean;
  liveCursors: boolean;
  onToggleLiveCursors: () => void;
  onAddMedia: (files: FileList) => void;
  onUpdateDraft: (fn: (draft: Draft) => Draft) => void;
  onSetPosted: (posted: boolean) => void;
  onRequestPost: () => void;
  onDropPhoto: (photoId: string) => void;
  onOpenInstagram: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [slidesDragOver, setSlidesDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const voterKey = me.email;
  const members = group.members;
  const threshold = Math.max(1, Math.ceil(members.length / 2));

  const [cursors, setCursors] = useState<Record<string, { x: number; y: number; color: string; name: string }>>({});
  const lastCursorSent = useRef(0);
  const roomId = `${group.id}:${post.id}`;

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:8788",
    party: "postit",
    room: roomId,
    enabled: liveCursors,
    onOpen() {
      socket.send(JSON.stringify({ type: "join", name: me.name, color: me.color }));
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
      socket.send(JSON.stringify({ type: "cursor", x: e.clientX, y: e.clientY }));
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [liveCursors, socket]);

  const handleToggleLiveCursors = () => {
    if (liveCursors) setCursors({});
    onToggleLiveCursors();
  };

  const pool = groupMediaPool(group);
  const mediaById = new Map(pool.map((p) => [p.id, p]));

  const slideIds = post.draft.slideIds;
  const slides = slideIds.map((id) => mediaById.get(id)).filter((p): p is Photo => !!p);

  const removeSlide = (id: string) => onUpdateDraft((draft) => ({ ...draft, slideIds: draft.slideIds.filter((x) => x !== id) }));

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

  const postDisabled = !isAdmin || (!post.posted && (slides.length === 0 || !canPost));
  const postTitle = !isAdmin ? "Only admins can mark a post as posted" : !canPost && !post.posted ? "Link an Instagram account first" : undefined;

  return (
    <>
      <div className={`${styles.home} ${previewOpen ? styles.previewGutter : ""}`}>
        <div className={styles.projHead}>
          <div>
            <h1>{post.name}</h1>
            <p>{post.date}</p>
          </div>
          {post.posted ? (
            <span className={`${styles.pill} ${styles.pillOk}`}>
              <Icon name="check" size={11} /> {postedLabel(post.postedAt)}
            </span>
          ) : post.requested ? (
            <span className={`${styles.pill} ${styles.pillWarn}`}>Requested</span>
          ) : null}
          {!post.posted && (
            <button className={styles.btnGhost2} disabled={post.requested || slides.length === 0} onClick={onRequestPost}>
              {post.requested ? "Requested" : "Request to post"}
            </button>
          )}
          <button className={styles.btnGhost2} disabled={postDisabled} title={postTitle} onClick={() => onSetPosted(!post.posted)}>
            {post.posted ? "Move back to drafts" : "Mark as posted"}
          </button>
          <button
            className={`${styles.btnGhost2} ${liveCursors ? styles.liveCursorsOn : ""}`}
            onClick={handleToggleLiveCursors}
            title={liveCursors ? "Hide teammates' live cursors" : "Show teammates' live cursors"}
          >
            <Icon name="cursor" size={13} /> Live cursors {liveCursors ? "on" : "off"}
          </button>
        </div>
        {!canPost && !post.posted && (
          <button type="button" className={styles.linkIgHint} onClick={onOpenInstagram}>
            <Icon name="instagram" size={12} /> Link an Instagram account to post
          </button>
        )}

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
                  if (e.target.files) onAddMedia(e.target.files);
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
                  <div key={photo.id} className={styles.voteCard}>
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

        <div className={styles.sectHead}>
          <h3>Caption</h3>
        </div>
        <textarea
          className={styles.captionBox}
          value={post.draft.caption}
          onChange={(e) => onUpdateDraft((draft) => ({ ...draft, caption: e.target.value }))}
          placeholder="Write a caption. Tag people and brands with @."
        />

        <div className={styles.sectHead}>
          <h3>Credits</h3>
        </div>
        {credits.length === 0 ? (
          <p className={styles.hint}>Add photos to see who shot them.</p>
        ) : (
          <ul className={styles.creditsList}>
            {credits.map((name) => (
              <li key={name}>Shot by {name}</li>
            ))}
          </ul>
        )}
      </div>

      {previewOpen ? (
        <PreviewTray group={group} post={post} slides={slides} onClose={() => setPreviewOpen(false)} />
      ) : (
        <button className={styles.previewReopen} onClick={() => setPreviewOpen(true)}>
          <Icon name="l" size={14} />
          <span>Preview</span>
        </button>
      )}

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
    </>
  );
}

function PreviewTray({
  group,
  post,
  slides,
  onClose,
}: {
  group: Group;
  post: PostCard;
  slides: Photo[];
  onClose: () => void;
}) {
  const [pvIndex, setPvIndex] = useState(0);
  const activeIndex = Math.min(pvIndex, Math.max(0, slides.length - 1));
  const handle = primaryHandle(group).replace(/^@/, "");

  return (
    <aside className={styles.previewTray}>
      <div className={styles.drawerHead}>
        <b>Preview</b>
        <button className={styles.iconClose} onClick={onClose} title="Hide preview">
          <Icon name="r" size={16} />
        </button>
      </div>
      <div className={styles.pvCard}>
        <div className={styles.pvHead}>
          <span className={styles.groupIcon} style={{ "--c": group.color, width: "26px", height: "26px", borderRadius: "50%", fontSize: "10px" } as CSSProperties}>
            {initials(group.name)}
          </span>
          <b>{handle}</b>
        </div>
        <div className={styles.pvImage}>
          {slides.length === 0 ? (
            <PhotoThumb photo={null} />
          ) : (
            <>
              <PhotoThumb photo={slides[activeIndex]} />
              {slides.length > 1 && (
                <>
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
          <Icon name="heart" size={20} />
          <Icon name="comment" size={20} />
          <Icon name="send" size={20} />
        </div>
        <div className={styles.pvCaption}>
          <b>{handle}</b> {post.draft.caption || <span className={styles.hint}>No caption yet</span>}
        </div>
      </div>
    </aside>
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
