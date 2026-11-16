"use client";

import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import styles from "./postit.module.css";

type PersonId = "maya" | "jordan" | "sam" | "lena" | "theo";

interface Person {
  id: PersonId;
  name: string;
  first: string;
  role: string;
  color: string;
  fg: string;
}

const PEOPLE: Person[] = [
  { id: "maya", name: "Maya Chen", first: "Maya", role: "Director", color: "#E4572E", fg: "#fff" },
  { id: "jordan", name: "Jordan Reyes", first: "Jordan", role: "Photographer", color: "#2F6FEB", fg: "#fff" },
  { id: "sam", name: "Sam Okafor", first: "Sam", role: "Videographer", color: "#13A06B", fg: "#fff" },
  { id: "lena", name: "Lena Park", first: "Lena", role: "Model", color: "#8B5CF6", fg: "#fff" },
  { id: "theo", name: "Theo Brooks", first: "Theo", role: "Brand rep", color: "#E3A008", fg: "#1F1604" },
];

const byId = (id: PersonId) => PEOPLE.find((p) => p.id === id)!;
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
}

type Vote = "up" | "down";

interface Post {
  slideIds: string[];
  caption: string;
  votes: Record<string, Record<string, Vote>>;
}

interface ProjectCard {
  id: string;
  name: string;
  date: string;
  photos: Photo[];
  drafts: number;
  ready: number;
  pending: number;
  post: Post;
  posted: boolean;
  postedAt: number | null;
  requested: boolean;
}

interface GroupPhoto {
  photo: Photo;
  projectId: string;
  projectName: string;
}

function groupPhotoPool(group: Group): GroupPhoto[] {
  const pool: GroupPhoto[] = [];
  for (const p of group.projects) for (const photo of p.photos) pool.push({ photo, projectId: p.id, projectName: p.name });
  return pool.sort((a, b) => b.photo.at - a.photo.at);
}

interface Member {
  id: string;
  name: string;
  role: string;
  color: string;
  fg: string;
}

function memberFromPerson(id: PersonId): Member {
  const p = byId(id);
  return { id: p.id, name: p.name, role: p.role, color: p.color, fg: p.fg };
}

function makeMember(name: string, role: string): Member {
  const id = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`;
  return { id, name, role: role.trim() || "Member", color: hashColor(name + role), fg: "#fff" };
}

const ROLE_OPTIONS = ["Director", "Photographer", "Videographer", "Model", "Editor", "Brand rep", "Social manager"];

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

interface Group {
  id: string;
  name: string;
  account: string;
  color: string;
  members: Member[];
  projects: ProjectCard[];
  chat: ChatMessage[];
  activity: ActivityItem[];
}

function makeSeedPhotos(count: number, members: PersonId[], startAgoMin: number): Photo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `seed-${startAgoMin}-${i}`,
    name: `IMG_${1000 + i}.jpg`,
    url: null,
    tone: (i * 37 + 20) % 80 + 10,
    uploadedBy: members.length ? byId(members[i % members.length]).name : "Team",
    at: Date.now() - (startAgoMin - i) * 60000,
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
      account: "@ribbonclub",
      color: "#E4572E",
      members: (["jordan", "lena", "maya"] as PersonId[]).map(memberFromPerson),
      projects: [
        {
          id: "p1",
          name: "Lookbook Shoot",
          date: "Shot Nov 8",
          photos: lookbookPhotos,
          drafts: 3,
          ready: 1,
          pending: 2,
          post: {
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
        { id: "a2", at: Date.now() - 95 * 60000, actorName: "Maya Chen", color: "#E4572E", fg: "#fff", verb: "created the project", target: "Lookbook Shoot", icon: "folder" },
      ],
    },
    {
      id: "riverfront",
      name: "Riverfront Café",
      account: "@riverfrontcafe",
      color: "#2F6FEB",
      members: (["maya", "sam"] as PersonId[]).map(memberFromPerson),
      projects: [
        {
          id: "p2",
          name: "Café Opening",
          date: "Shot Nov 2",
          photos: cafePhotos,
          drafts: 1,
          ready: 1,
          pending: 0,
          post: { slideIds: [cafePhotos[1].id], caption: "We're open! First latte is on us this weekend.", votes: { [cafePhotos[1].id]: { maya: "up", sam: "up" } } },
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
        { id: "a3", at: Date.now() - 3 * 24 * 60 * 60000 - 40 * 60000, actorName: "Maya Chen", color: "#E4572E", fg: "#fff", verb: "created the project", target: "Café Opening", icon: "folder" },
      ],
    },
    {
      id: "studio",
      name: "Postit Studio",
      account: "@postit.studio",
      color: "#13A06B",
      members: (["sam", "lena", "jordan", "theo"] as PersonId[]).map(memberFromPerson),
      projects: [
        {
          id: "p3",
          name: "Studio BTS",
          date: "Ongoing",
          photos: btsPhotos,
          drafts: 0,
          ready: 0,
          pending: 0,
          post: { slideIds: [], caption: "", votes: {} },
          posted: false,
          postedAt: null,
          requested: false,
        },
      ],
      chat: [],
      activity: [{ id: "a1", at: Date.now() - 20 * 60000, actorName: "Sam Okafor", color: "#13A06B", fg: "#fff", verb: "created the project", target: "Studio BTS", icon: "folder" }],
    },
  ];
}

function revokeBlobUrls(groups: Group[]) {
  for (const g of groups) for (const p of g.projects) for (const ph of p.photos) if (ph.url?.startsWith("blob:")) URL.revokeObjectURL(ph.url);
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
  color: string;
}

type Stage = "login" | "groups" | "app";
type Screen = "projects" | "project" | "posted" | "chat" | "activity";

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
  const [stage, setStage] = useState<Stage>("login");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [groups, setGroups] = useState<Group[]>(makeInitialGroups);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("projects");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [invitingTeam, setInvitingTeam] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

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

  const handleSignIn = (name: string, email: string) => {
    setUser({ name, email, color: hashColor(email || name) });
    setStage("groups");
    pushToast(`Signed in as <em>${name}</em>. Pick a group to get started.`);
  };

  const handleSelectGroup = (id: string) => {
    setActiveGroupId(id);
    setScreen("projects");
    setActiveProjectId(null);
    setStage("app");
    setMenuOpen(false);
  };

  const handleCreateGroup = (name: string, accountInput: string, invitees: Member[]) => {
    const id = `${slugify(name)}-${Date.now().toString(36)}`;
    const account = normalizeHandle(accountInput) || `@${slugify(name)}`;
    const color = GROUP_COLORS[groups.length % GROUP_COLORS.length];
    const group: Group = { id, name, account, color, members: invitees, projects: [], chat: [], activity: [] };
    setGroups((g) => [...g, group]);
    setActiveGroupId(id);
    setScreen("projects");
    setActiveProjectId(null);
    setStage("app");
    setCreatingGroup(false);
    for (const m of invitees) {
      pushActivity(id, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: `invited ${m.name} as ${m.role} to`, target: name, icon: "plus" });
    }
    pushToast(`Created <em>${name}</em>${invitees.length ? ` with ${invitees.length} teammate${invitees.length === 1 ? "" : "s"}` : ""}. Start a project when you're ready.`);
  };

  const handleSaveMembers = (groupId: string, nextMembers: Member[]) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const prevIds = new Set(group.members.map((m) => m.id));
    const nextIds = new Set(nextMembers.map((m) => m.id));
    const added = nextMembers.filter((m) => !prevIds.has(m.id));
    const removed = group.members.filter((m) => !nextIds.has(m.id));
    updateGroup(groupId, (g) => ({ ...g, members: nextMembers }));
    for (const m of added) {
      pushActivity(groupId, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: `invited ${m.name} as ${m.role} to`, target: group.name, icon: "plus" });
    }
    for (const m of removed) {
      pushActivity(groupId, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: `removed ${m.name} from`, target: group.name, icon: "x" });
    }
    setInvitingTeam(false);
    pushToast(added.length ? `Invited ${added.map((m) => m.name).join(", ")}.` : "Updated the team.");
  };

  const handleCreateProject = (name: string, when: string) => {
    if (!activeGroupId) return;
    const id = `${slugify(name)}-${Date.now().toString(36)}`;
    const date = when.trim() || `Added ${formatToday()}`;
    const project: ProjectCard = {
      id,
      name,
      date,
      photos: [],
      drafts: 0,
      ready: 0,
      pending: 0,
      post: { slideIds: [], caption: "", votes: {} },
      posted: false,
      postedAt: null,
      requested: false,
    };
    updateGroup(activeGroupId, (g) => ({ ...g, projects: [...g.projects, project] }));
    pushActivity(activeGroupId, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: "created the project", target: name, icon: "folder" });
    setActiveProjectId(id);
    setScreen("project");
    setCreatingProject(false);
    pushToast(`Created <em>${name}</em>. Add some photos to get started.`);
  };

  const handleAddPhotos = (projectId: string, files: FileList) => {
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
    }));
    updateGroup(activeGroupId, (g) => ({
      ...g,
      projects: g.projects.map((p) => (p.id === projectId ? { ...p, photos: [...p.photos, ...newPhotos] } : p)),
    }));
    const projectName = groups.find((g) => g.id === activeGroupId)?.projects.find((p) => p.id === projectId)?.name;
    pushActivity(activeGroupId, {
      actorName: user.name,
      color: user.color,
      fg: "#fff",
      verb: `added ${newPhotos.length} ${newPhotos.length === 1 ? "photo" : "photos"} to`,
      target: projectName,
      icon: "image",
    });
    pushToast(`Added ${newPhotos.length} ${newPhotos.length === 1 ? "photo" : "photos"}.`);
  };

  const handleUpdatePost = (projectId: string, fn: (post: Post) => Post) => {
    if (!activeGroupId) return;
    updateGroup(activeGroupId, (g) => ({
      ...g,
      projects: g.projects.map((p) => (p.id === projectId ? { ...p, post: fn(p.post) } : p)),
    }));
  };

  const handleSetPosted = (projectId: string, posted: boolean) => {
    if (!activeGroupId) return;
    const projectName = groups.find((g) => g.id === activeGroupId)?.projects.find((p) => p.id === projectId)?.name ?? "a project";
    updateGroup(activeGroupId, (g) => ({
      ...g,
      projects: g.projects.map((p) => (p.id === projectId ? { ...p, posted, postedAt: posted ? Date.now() : null, requested: false } : p)),
    }));
    pushActivity(activeGroupId, {
      actorName: user?.name ?? "You",
      color: user?.color ?? "#888",
      fg: "#fff",
      verb: posted ? `marked ${projectName} as posted` : `moved ${projectName} back to drafts`,
      icon: posted ? "check" : "folder",
    });
  };

  const handleRequestPost = (projectId: string, projectName: string) => {
    if (!activeGroupId) return;
    updateGroup(activeGroupId, (g) => ({
      ...g,
      projects: g.projects.map((p) => (p.id === projectId ? { ...p, requested: true } : p)),
    }));
    pushActivity(activeGroupId, { actorName: user?.name ?? "You", color: user?.color ?? "#888", fg: "#fff", verb: "asked the group to approve", target: projectName, icon: "check" });
    pushToast(`Asked the group to approve <em>${projectName}</em>.`);
  };

  const handleDropPhotoOnProject = (projectId: string, photoId: string) => {
    handleUpdatePost(projectId, (post) => (post.slideIds.includes(photoId) ? post : { ...post, slideIds: [...post.slideIds, photoId] }));
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
    setScreen("projects");
    setActiveProjectId(null);
    setMenuOpen(false);
    setInvitingTeam(false);
  };

  const handleSignOut = () => {
    revokeBlobUrls(groups);
    setStage("login");
    setUser(null);
    setActiveGroupId(null);
    setScreen("projects");
    setActiveProjectId(null);
    setGroups(makeInitialGroups());
    setMenuOpen(false);
    setCreatingGroup(false);
    setCreatingProject(false);
    setInvitingTeam(false);
  };

  const notReady = (label: string) => pushToast(`${label} isn't part of this prototype yet.`);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  return (
    <div className={styles.page}>
      {stage === "login" && <LoginScreen onSignIn={handleSignIn} />}

      {stage === "groups" && user && (
        <GroupPicker user={user} groups={groups} onSelect={handleSelectGroup} onCreate={() => setCreatingGroup(true)} onSignOut={handleSignOut} />
      )}

      {stage === "app" && user && activeGroup && (
        <AppShell
          user={user}
          group={activeGroup}
          screen={screen}
          activeProjectId={activeProjectId}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((v) => !v)}
          onSwitchGroup={handleSwitchGroup}
          onSignOut={handleSignOut}
          onDm={(p) => notReady(`Messaging ${p.name.split(/\s+/)[0]}`)}
          onInvite={() => setInvitingTeam(true)}
          onRail={(label) => notReady(label)}
          onOpenProjects={() => {
            setScreen("projects");
            setActiveProjectId(null);
          }}
          onOpenPosted={() => {
            setScreen("posted");
            setActiveProjectId(null);
          }}
          onOpenChat={() => {
            setScreen("chat");
            setActiveProjectId(null);
          }}
          onOpenActivity={() => {
            setScreen("activity");
            setActiveProjectId(null);
          }}
          onOpenProject={(id) => {
            setActiveProjectId(id);
            setScreen("project");
          }}
          onNewProject={() => setCreatingProject(true)}
          onAddPhotos={handleAddPhotos}
          onUpdatePost={handleUpdatePost}
          onSetPosted={handleSetPosted}
          onRequestPost={handleRequestPost}
          onDropPhotoOnProject={handleDropPhotoOnProject}
          onSendChat={(text) => handleSendChat(activeGroup.id, text)}
        />
      )}

      {creatingGroup && <CreateGroupModal onCreate={handleCreateGroup} onCancel={() => setCreatingGroup(false)} />}
      {creatingProject && <CreateProjectModal onCreate={handleCreateProject} onCancel={() => setCreatingProject(false)} />}
      {invitingTeam && activeGroup && (
        <InviteModal group={activeGroup} onSave={(members) => handleSaveMembers(activeGroup.id, members)} onCancel={() => setInvitingTeam(false)} />
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

function LoginScreen({ onSignIn }: { onSignIn: (name: string, email: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSignIn(name.trim(), email.trim());
  };

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginIntro}>
        <div className={styles.wm}>
          postit<i className={styles.wmDot} />
        </div>
        <p>One shared board for the whole shoot. Upload, credit, vote and build the post together.</p>
        <p className={styles.proto}>Prototype for user testing — sign-in is simulated and nothing you type is sent anywhere.</p>
      </div>
      <form className={styles.loginCard} onSubmit={submit}>
        <h2>Sign in</h2>
        <p className={styles.sub}>New here? These fields just set up your profile — nothing to verify yet.</p>
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
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className={styles.btnPrimary} disabled={!canSubmit}>
          Sign in
        </button>
      </form>
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
        <p>You can belong to more than one group. Each group posts to its own account and keeps its own projects.</p>
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
                <span className={styles.handle}>{g.account}</span>
                <span className={styles.groupStats}>
                  {g.members.length + 1} people · {g.projects.length} {g.projects.length === 1 ? "project" : "projects"}
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
  name: string;
  role: string;
  existing?: Member;
}

function draftsToMembers(drafts: DraftMember[]): Member[] {
  return drafts
    .filter((d) => d.name.trim())
    .map((d) =>
      d.existing ? { ...d.existing, name: d.name.trim(), role: d.role.trim() || "Member" } : makeMember(d.name.trim(), d.role.trim() || "Member")
    );
}

function MemberEditor({ drafts, setDrafts }: { drafts: DraftMember[]; setDrafts: (fn: (d: DraftMember[]) => DraftMember[]) => void }) {
  const addRow = () => setDrafts((d) => [...d, { key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: "", role: "" }]);
  const removeRow = (key: string) => setDrafts((d) => d.filter((r) => r.key !== key));
  const updateRow = (key: string, patch: Partial<DraftMember>) => setDrafts((d) => d.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const presentNames = new Set(drafts.map((d) => d.name.trim().toLowerCase()).filter(Boolean));
  const suggestions = PEOPLE.filter((p) => !presentNames.has(p.name.toLowerCase()));

  return (
    <div className={styles.memberEditor}>
      {drafts.map((d) => (
        <div key={d.key} className={styles.memberRow}>
          <input className={styles.input} placeholder="Name" value={d.name} onChange={(e) => updateRow(d.key, { name: e.target.value })} />
          <input className={styles.input} list="postit-roles" placeholder="Role" value={d.role} onChange={(e) => updateRow(d.key, { role: e.target.value })} />
          <button type="button" className={styles.iconClose} onClick={() => removeRow(d.key)} title="Remove">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <datalist id="postit-roles">
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <button type="button" className={styles.btnGhost} onClick={addRow}>
        <Icon name="plus" size={14} /> Add teammate
      </button>
      {suggestions.length > 0 && (
        <div className={styles.chipRow}>
          {suggestions.map((p) => (
            <button
              type="button"
              key={p.id}
              className={styles.chip}
              onClick={() => setDrafts((d) => [...d, { key: `sugg-${p.id}-${Date.now()}`, name: p.name, role: p.role }])}
            >
              + {p.first} · {p.role}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateGroupModal({ onCreate, onCancel }: { onCreate: (name: string, account: string, invitees: Member[]) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [drafts, setDrafts] = useState<DraftMember[]>([]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), account, draftsToMembers(drafts));
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <form className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Create a group</h2>
        <p className={styles.sub}>Each group has its own account and its own projects.</p>
        <div className={styles.field}>
          <label htmlFor="gname">Group name</label>
          <input id="gname" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Outdoors" autoFocus />
        </div>
        <div className={styles.field}>
          <label htmlFor="gaccount">Account it posts to</label>
          <input id="gaccount" className={styles.input} value={account} onChange={(e) => setAccount(e.target.value)} placeholder="@acmeoutdoors" />
        </div>
        <div className={styles.field}>
          <label>Invite teammates (optional)</label>
          <MemberEditor drafts={drafts} setDrafts={setDrafts} />
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

function InviteModal({ group, onSave, onCancel }: { group: Group; onSave: (members: Member[]) => void; onCancel: () => void }) {
  const [drafts, setDrafts] = useState<DraftMember[]>(() => group.members.map((m) => ({ key: m.id, name: m.name, role: m.role, existing: m })));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(draftsToMembers(drafts));
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <form className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Team &amp; roles</h2>
        <p className={styles.sub}>
          Who&rsquo;s in <b>{group.name}</b>, and what they do.
        </p>
        <MemberEditor drafts={drafts} setDrafts={setDrafts} />
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

function CreateProjectModal({ onCreate, onCancel }: { onCreate: (name: string, when: string) => void; onCancel: () => void }) {
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
        <h2>Create a project</h2>
        <p className={styles.sub}>A project holds the photos, drafts and votes for one shoot.</p>
        <div className={styles.field}>
          <label htmlFor="pname">Project name</label>
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
            Create project
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
  activeProjectId,
  menuOpen,
  onToggleMenu,
  onSwitchGroup,
  onSignOut,
  onDm,
  onInvite,
  onRail,
  onOpenProjects,
  onOpenPosted,
  onOpenChat,
  onOpenActivity,
  onOpenProject,
  onNewProject,
  onAddPhotos,
  onUpdatePost,
  onSetPosted,
  onRequestPost,
  onDropPhotoOnProject,
  onSendChat,
}: {
  user: CurrentUser;
  group: Group;
  screen: Screen;
  activeProjectId: string | null;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onSwitchGroup: () => void;
  onSignOut: () => void;
  onDm: (p: Member) => void;
  onInvite: () => void;
  onRail: (label: string) => void;
  onOpenProjects: () => void;
  onOpenPosted: () => void;
  onOpenChat: () => void;
  onOpenActivity: () => void;
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onAddPhotos: (projectId: string, files: FileList) => void;
  onUpdatePost: (projectId: string, fn: (post: Post) => Post) => void;
  onSetPosted: (projectId: string, posted: boolean) => void;
  onRequestPost: (projectId: string, projectName: string) => void;
  onDropPhotoOnProject: (projectId: string, photoId: string) => void;
  onSendChat: (text: string) => void;
}) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const members = group.members;
  const first = user.name.trim().split(/\s+/)[0] || user.name;
  const activeProject = group.projects.find((p) => p.id === activeProjectId) ?? null;

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
          {screen === "projects" && <span className={styles.handleMono}>{group.account}</span>}
          {screen === "posted" && (
            <>
              <span className={styles.crumbSep}>›</span>
              <span className={styles.crumbCurrent}>Posted</span>
            </>
          )}
          {screen === "chat" && (
            <>
              <span className={styles.crumbSep}>›</span>
              <span className={styles.crumbCurrent}>Chat</span>
            </>
          )}
          {screen === "activity" && (
            <>
              <span className={styles.crumbSep}>›</span>
              <span className={styles.crumbCurrent}>Activity</span>
            </>
          )}
          {screen === "project" && activeProject && (
            <>
              <span className={styles.crumbSep}>›</span>
              <button className={styles.crumbBtn} onClick={onOpenProjects}>
                Projects
              </button>
              <span className={styles.crumbSep}>›</span>
              <span className={styles.crumbCurrent}>{activeProject.name}</span>
            </>
          )}
        </nav>
        <div className={styles.grow} />
        <div className={styles.presence}>
          {members.map((p) => (
            <button key={p.id} className={styles.presenceBtn} title={`${p.name} · ${p.role}`} onClick={() => onDm(p)}>
              <Avatar name={p.name} color={p.color} fg={p.fg} />
            </button>
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
          <button className={`${styles.ib} ${screen === "projects" || screen === "project" ? styles.ibOn : ""}`} title="Projects" onClick={onOpenProjects}>
            <Icon name="folder" size={20} />
            Projects
          </button>
          <button className={`${styles.ib} ${mediaOpen ? styles.ibOn : ""}`} title="Media" onClick={() => setMediaOpen((v) => !v)}>
            <Icon name="image" size={20} />
            Media
          </button>
          <button className={`${styles.ib} ${screen === "posted" ? styles.ibOn : ""}`} title="Posted" onClick={onOpenPosted}>
            <Icon name="check" size={20} />
            Posted
          </button>
          <button className={`${styles.ib} ${screen === "chat" ? styles.ibOn : ""}`} title="Chat" onClick={onOpenChat}>
            <Icon name="chat" size={20} />
            Chat
          </button>
          <button className={`${styles.ib} ${screen === "activity" ? styles.ibOn : ""}`} title="Activity" onClick={onOpenActivity}>
            <Icon name="clock" size={20} />
            Activity
          </button>
          <span className={styles.ibSpacer} />
          <button className={styles.ib} title="Settings" onClick={() => onRail("Settings")}>
            <Icon name="sliders" size={20} />
            Settings
          </button>
        </nav>

        <main className={styles.main}>
          {screen === "projects" && (
            <ProjectsGrid
              group={group}
              members={members}
              view="active"
              onOpenProject={onOpenProject}
              onNewProject={onNewProject}
              onDropPhoto={onDropPhotoOnProject}
            />
          )}
          {screen === "posted" && (
            <ProjectsGrid group={group} members={members} view="posted" onOpenProject={onOpenProject} onNewProject={onNewProject} onDropPhoto={onDropPhotoOnProject} />
          )}
          {screen === "chat" && <ChatPanel group={group} onSend={onSendChat} />}
          {screen === "activity" && <ActivityPanel group={group} />}
          {screen === "project" && activeProject && (
            <ProjectDetail
              group={group}
              project={activeProject}
              me={user}
              onAddPhotos={(files) => onAddPhotos(activeProject.id, files)}
              onUpdatePost={(fn) => onUpdatePost(activeProject.id, fn)}
              onSetPosted={(posted) => onSetPosted(activeProject.id, posted)}
              onRequestPost={() => onRequestPost(activeProject.id, activeProject.name)}
              onDropPhoto={(photoId) => onDropPhotoOnProject(activeProject.id, photoId)}
            />
          )}
        </main>

        {mediaOpen && (
          <MediaDrawer
            group={group}
            activeProjectId={screen === "project" ? activeProjectId : null}
            onAddToActive={activeProjectId ? (photoId) => onDropPhotoOnProject(activeProjectId, photoId) : null}
            onClose={() => setMediaOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function ChatPanel({ group, onSend }: { group: Group; onSend: (text: string) => void }) {
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <div className={styles.chatWrap}>
      <div className={styles.chatHead}>
        <h1>{group.name} · Chat</h1>
        <p>Everyone in {group.name} sees this thread.</p>
      </div>
      <div className={styles.chatList}>
        {group.chat.length === 0 ? (
          <p className={styles.hint}>No messages yet. Say hello.</p>
        ) : (
          group.chat.map((m) => (
            <div key={m.id} className={styles.chatMsg}>
              <Avatar name={m.authorName} color={m.color} fg={m.fg} />
              <div className={styles.chatBody}>
                <div className={styles.chatMeta}>
                  <b>{m.authorId === "me" ? "You" : m.authorName}</b>
                  <span className={styles.hint}>{timeAgo(m.at)}</span>
                </div>
                <p>{m.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
      <form className={styles.chatInputRow} onSubmit={submit}>
        <input className={styles.input} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${group.name}…`} />
        <button type="submit" className={styles.btnSm} disabled={!text.trim()}>
          <Icon name="send" size={14} /> Send
        </button>
      </form>
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

type PhotoStatus = "approved" | "needs" | "declined";

function photoStatus(ups: number, downs: number): PhotoStatus {
  if (ups > downs && ups > 0) return "approved";
  if (downs > ups && downs > 0) return "declined";
  return "needs";
}

const STATUS_META: Record<PhotoStatus, { label: string; icon: keyof typeof ICON_PATHS; pill: string }> = {
  approved: { label: "Approved", icon: "check", pill: styles.pillOk },
  declined: { label: "Declined", icon: "x", pill: styles.pillBad },
  needs: { label: "Needs vote", icon: "clock", pill: styles.pillWarn },
};

function postedLabel(postedAt: number | null): string {
  if (!postedAt) return "Posted";
  return `Posted ${new Date(postedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function ProjectsGrid({
  group,
  members,
  view,
  onOpenProject,
  onNewProject,
  onDropPhoto,
}: {
  group: Group;
  members: Member[];
  view: "active" | "posted";
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onDropPhoto: (projectId: string, photoId: string) => void;
}) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const projects = group.projects.filter((p) => (view === "posted" ? p.posted : !p.posted));

  return (
    <div className={styles.home}>
      <h1>{view === "posted" ? `${group.name} · Posted` : group.name}</h1>
      <p>
        {group.account} · {projects.length} {projects.length === 1 ? "project" : "projects"}
      </p>
      {projects.length === 0 && view === "posted" ? (
        <div className={styles.emptyBlock}>
          <p>Nothing posted yet. Mark a project as posted once it&rsquo;s live.</p>
        </div>
      ) : (
        <div className={styles.pgrid}>
          {projects.map((proj) => {
            const cover: (Photo | null)[] = [0, 1, 2].map((i) => proj.photos[i] ?? null);
            return (
              <button
                key={proj.id}
                className={`${styles.pc} ${dragOverId === proj.id ? styles.pcDrop : ""}`}
                onClick={() => onOpenProject(proj.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(proj.id);
                }}
                onDragLeave={() => setDragOverId((id) => (id === proj.id ? null : id))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverId(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) onDropPhoto(proj.id, id);
                }}
              >
                <span className={styles.col}>
                  {cover.map((photo, i) => (
                    <PhotoThumb key={i} photo={photo} />
                  ))}
                </span>
                <span className={styles.pcB}>
                  <b>{proj.name}</b>
                  <small>
                    {proj.date} · {proj.photos.length} photos
                  </small>
                  <span className={styles.pcF}>
                    {proj.posted ? (
                      <span className={`${styles.pill} ${styles.pillOk}`}>
                        <Icon name="check" size={11} /> {postedLabel(proj.postedAt)}
                      </span>
                    ) : (
                      <>
                        {proj.requested && <span className={`${styles.pill} ${styles.pillWarn}`}>Requested</span>}
                        {proj.ready > 0 && <span className={`${styles.pill} ${styles.pillOk}`}>{proj.ready} ready to post</span>}
                        {proj.pending > 0 && <span className={`${styles.pill} ${styles.pillWarn}`}>{proj.pending} in progress</span>}
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
            <button className={`${styles.pc} ${styles.pcNew}`} onClick={onNewProject}>
              <Icon name="plus" size={22} /> New project
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectDetail({
  group,
  project,
  me,
  onAddPhotos,
  onUpdatePost,
  onSetPosted,
  onRequestPost,
  onDropPhoto,
}: {
  group: Group;
  project: ProjectCard;
  me: CurrentUser;
  onAddPhotos: (files: FileList) => void;
  onUpdatePost: (fn: (post: Post) => Post) => void;
  onSetPosted: (posted: boolean) => void;
  onRequestPost: () => void;
  onDropPhoto: (photoId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [slidesDragOver, setSlidesDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const voterKey = me.email;
  const members = group.members;

  const fullPool = groupPhotoPool(group);
  const poolById = new Map(fullPool.map((gp) => [gp.photo.id, gp]));

  const slideIds = project.post.slideIds;
  const slides = slideIds.map((id) => poolById.get(id)).filter((gp): gp is GroupPhoto => !!gp);

  const removeSlide = (id: string) => onUpdatePost((post) => ({ ...post, slideIds: post.slideIds.filter((x) => x !== id) }));
  const moveSlide = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= slideIds.length) return;
    onUpdatePost((post) => {
      const next = post.slideIds.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return { ...post, slideIds: next };
    });
  };

  const setVote = (photoId: string, voter: string, vote: Vote) => {
    onUpdatePost((post) => {
      const current = post.votes[photoId]?.[voter];
      const forPhoto = { ...(post.votes[photoId] ?? {}) };
      if (current === vote) delete forPhoto[voter];
      else forPhoto[voter] = vote;
      return { ...post, votes: { ...post.votes, [photoId]: forPhoto } };
    });
  };
  const cycleMemberVote = (photoId: string, voter: string) => {
    onUpdatePost((post) => {
      const current = post.votes[photoId]?.[voter];
      const next: Vote | undefined = current === undefined ? "up" : current === "up" ? "down" : undefined;
      const forPhoto = { ...(post.votes[photoId] ?? {}) };
      if (next === undefined) delete forPhoto[voter];
      else forPhoto[voter] = next;
      return { ...post, votes: { ...post.votes, [photoId]: forPhoto } };
    });
  };

  const credits: string[] = [];
  for (const gp of slides) if (!credits.includes(gp.photo.uploadedBy)) credits.push(gp.photo.uploadedBy);

  return (
    <>
      <div className={`${styles.home} ${previewOpen ? styles.previewGutter : ""}`}>
        <div className={styles.projHead}>
          <div>
            <h1>{project.name}</h1>
            <p>
              {project.date} · {project.photos.length} {project.photos.length === 1 ? "photo" : "photos"}
            </p>
          </div>
          {project.posted ? (
            <span className={`${styles.pill} ${styles.pillOk}`}>
              <Icon name="check" size={11} /> {postedLabel(project.postedAt)}
            </span>
          ) : project.requested ? (
            <span className={`${styles.pill} ${styles.pillWarn}`}>Requested</span>
          ) : null}
          {!project.posted && (
            <button className={styles.btnGhost2} disabled={project.requested || slides.length === 0} onClick={onRequestPost}>
              {project.requested ? "Requested" : "Request to post"}
            </button>
          )}
          <button className={styles.btnGhost2} disabled={!project.posted && slides.length === 0} onClick={() => onSetPosted(!project.posted)}>
            {project.posted ? "Move back to drafts" : "Mark as posted"}
          </button>
          <button className={styles.btnSm} onClick={() => fileRef.current?.click()}>
            <Icon name="plus" size={16} /> Add photos
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) onAddPhotos(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <section className={styles.work}>
          <div className={styles.sectHead}>
            <h3>Photos in this post</h3>
            <span className={styles.hint}>{slides.length} added</span>
          </div>
          <div
            className={`${styles.slideDrop} ${slidesDragOver ? styles.slideDropOver : ""}`}
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
            {slides.length === 0 ? (
              <div className={styles.slidePlaceholder}>Open Media in the side rail and drag or click photos in here.</div>
            ) : (
              <div className={styles.slideRow}>
                {slides.map((gp, i) => {
                  const voteMap = project.post.votes[gp.photo.id] ?? {};
                  const ups = Object.values(voteMap).filter((v) => v === "up").length;
                  const downs = Object.values(voteMap).filter((v) => v === "down").length;
                  const myVote = voteMap[voterKey];
                  const status = photoStatus(ups, downs);
                  const statusMeta = STATUS_META[status];
                  return (
                    <div key={gp.photo.id} className={styles.slideCard}>
                      <div className={styles.slideThumb}>
                        <PhotoThumb photo={gp.photo} />
                        <button className={styles.slideRemove} onClick={() => removeSlide(gp.photo.id)} title="Remove">
                          <Icon name="x" size={12} />
                        </button>
                        <div className={styles.slideNav}>
                          <button disabled={i === 0} onClick={() => moveSlide(i, -1)} title="Move left">
                            <Icon name="l" size={12} />
                          </button>
                          <button disabled={i === slides.length - 1} onClick={() => moveSlide(i, 1)} title="Move right">
                            <Icon name="r" size={12} />
                          </button>
                        </div>
                      </div>
                      <span className={`${styles.pill} ${statusMeta.pill} ${styles.statusPill}`}>
                        <Icon name={statusMeta.icon} size={11} /> {statusMeta.label}
                      </span>
                      <div className={styles.voteRow}>
                        <button
                          className={`${styles.voteBtn} ${myVote === "up" ? styles.voteBtnUpOn : ""}`}
                          onClick={() => setVote(gp.photo.id, voterKey, "up")}
                          title="You like this photo"
                        >
                          <Icon name="up" size={12} /> {ups}
                        </button>
                        <button
                          className={`${styles.voteBtn} ${myVote === "down" ? styles.voteBtnDownOn : ""}`}
                          onClick={() => setVote(gp.photo.id, voterKey, "down")}
                          title="You don't like this photo"
                        >
                          <Icon name="down" size={12} /> {downs}
                        </button>
                      </div>
                      {members.length > 0 && (
                        <div className={styles.voteMembers}>
                          {members.map((p) => {
                            const v = voteMap[p.id];
                            return (
                              <button
                                key={p.id}
                                className={styles.voteMember}
                                onClick={() => cycleMemberVote(gp.photo.id, p.id)}
                                title={`${p.name}: ${v ?? "no vote"} (click to change)`}
                              >
                                <Avatar name={p.name} color={p.color} fg={p.fg} size="sm" />
                                {v && <i className={v === "up" ? styles.voteTickUp : styles.voteTickDown} />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.sectHead}>
            <h3>Caption</h3>
          </div>
          <textarea
            className={styles.captionBox}
            value={project.post.caption}
            onChange={(e) => onUpdatePost((post) => ({ ...post, caption: e.target.value }))}
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
        </section>
      </div>

      {previewOpen ? (
        <PreviewTray group={group} project={project} slides={slides} onClose={() => setPreviewOpen(false)} />
      ) : (
        <button className={styles.previewReopen} onClick={() => setPreviewOpen(true)}>
          <Icon name="l" size={14} />
          <span>Preview</span>
        </button>
      )}
    </>
  );
}

function PreviewTray({
  group,
  project,
  slides,
  onClose,
}: {
  group: Group;
  project: ProjectCard;
  slides: GroupPhoto[];
  onClose: () => void;
}) {
  const [pvIndex, setPvIndex] = useState(0);
  const activeIndex = Math.min(pvIndex, Math.max(0, slides.length - 1));
  const handle = group.account.replace(/^@/, "");

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
              <PhotoThumb photo={slides[activeIndex].photo} />
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
          <b>{handle}</b> {project.post.caption || <span className={styles.hint}>No caption yet</span>}
        </div>
      </div>
    </aside>
  );
}

function MediaDrawer({
  group,
  activeProjectId,
  onAddToActive,
  onClose,
}: {
  group: Group;
  activeProjectId: string | null;
  onAddToActive: ((photoId: string) => void) | null;
  onClose: () => void;
}) {
  const pool = groupPhotoPool(group);
  const activeProject = activeProjectId ? group.projects.find((p) => p.id === activeProjectId) ?? null : null;
  const slideIds = activeProject?.post.slideIds ?? [];

  return (
    <aside className={styles.drawer}>
      <div className={styles.drawerHead}>
        <div>
          <b>Media</b>
          <div className={styles.hint}>
            {group.name} · {pool.length} {pool.length === 1 ? "photo" : "photos"}
          </div>
        </div>
        <button className={styles.iconClose} onClick={onClose} title="Close">
          <Icon name="x" size={16} />
        </button>
      </div>
      <p className={styles.traySub}>
        {activeProject
          ? `Drag a photo onto "${activeProject.name}", or click to add it.`
          : "Open a project, or drop a photo onto one from the Projects grid."}
      </p>
      {pool.length === 0 ? (
        <p className={styles.emptyTray}>No photos in {group.name} yet.</p>
      ) : (
        <div className={styles.drawerGrid}>
          {pool.map((gp) => {
            const included = slideIds.includes(gp.photo.id);
            return (
              <button
                key={gp.photo.id}
                className={`${styles.trayThumb} ${included ? styles.trayThumbOn : ""}`}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", gp.photo.id)}
                onClick={() => onAddToActive?.(gp.photo.id)}
                title={gp.photo.name}
              >
                <PhotoThumb photo={gp.photo} />
                {included && (
                  <span className={styles.trayCheck}>
                    <Icon name="check" size={12} />
                  </span>
                )}
                <span className={styles.trayTag}>{gp.projectName}</span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
