import type { LucideIcon } from "lucide-react";
import {
  Award,
  Camera,
  Clapperboard,
  Code2,
  Gamepad2,
  Heart,
  Lightbulb,
  Monitor,
  Network,
  PenTool,
  Share2,
  Sparkles,
  Target,
  Terminal,
  Trophy,
} from "lucide-react";

/* ---------------------------------------------------------------------------
   Navigation
--------------------------------------------------------------------------- */
export const NAV_LINKS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "board", label: "Board" },
  { id: "teams", label: "Teams" },
  { id: "events", label: "Events" },
  // { id: "gallery", label: "Gallery" },  // hidden — no assets yet
  { id: "membership", label: "Membership" },
  { id: "faqs", label: "FAQs" },
  { id: "contact", label: "Contact" },
] as const;

/* ---------------------------------------------------------------------------
   Hero stats
--------------------------------------------------------------------------- */
export const STATS: {
  end: number;
  suffix?: string;
  prefix?: string;
  grouped?: boolean;
  label: string;
}[] = [
  { end: 215, label: "Members" },
  { end: 6, label: "Teams" },
  { end: 20, suffix: "+", label: "Events" },
  { end: 2019, grouped: false, label: "Established" },
];

/* ---------------------------------------------------------------------------
   About
--------------------------------------------------------------------------- */
export const OBJECTIVES_TEXT =
  "We, the bona fide Computer Engineering students of Bulacan State University Meneses Campus, in our fervent " +
  "desire to establish a genuine student organization that will unite the engineering students, promote and protect " +
  "their personal welfare, foster closer and active relationships among students and other sectors of the organization, " +
  "and prepare the students to become constructive and effective future educators in order to instill national " +
  "consciousness for the advancement of the students under the benign guidance of God, do ordain and promulgate " +
  "this constitution.";

export const BENEFITS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Code2,
    title: "Skill Development",
    desc: "Hands-on workshops in programming, hardware, and emerging technologies — from beginner to advanced.",
  },
  {
    icon: Network,
    title: "Network & Connections",
    desc: "Connect with fellow CpE students, alumni, faculty, and industry professionals across the ICPEP network.",
  },
  {
    icon: Trophy,
    title: "Competition Experience",
    desc: "Represent the campus in hackathons, coding challenges, quiz bees, and esports tournaments.",
  },
  {
    icon: Target,
    title: "Leadership Opportunities",
    desc: "Lead teams, organize events, and build the management experience employers actually look for.",
  },
  {
    icon: Award,
    title: "Certifications",
    desc: "Earn certificates from seminars, trainings, and workshops that strengthen your résumé and portfolio.",
  },
  {
    icon: Heart,
    title: "Lifetime Community",
    desc: "Join a family of engineers who support each other far beyond graduation.",
  },
];

export const ACTIVITIES: { icon: LucideIcon; label: string }[] = [
  { icon: Monitor, label: "Seminars" },
  { icon: Code2, label: "Workshops" },
  { icon: Trophy, label: "Competitions" },
  { icon: Heart, label: "Outreach" },
];

/* ---------------------------------------------------------------------------
   Executive board

   Officer *identity* — who holds a role, and their name — is no longer
   hardcoded here. It comes live from GET /api/officers (backend
   OfficerController), which reads the same `users` table User Management
   edits: renaming an officer or handing a role to someone else there is what
   the public site shows, with no code change. See components/sections/Board.tsx
   for the fetch.

   What's left here is presentation the accounts table has no column for —
   a portrait and a year/program line — keyed by the officer's admin email
   (the seeded, stable ...@icpep.se address), since that outlives a name
   change. An account with no entry below still shows: the board falls back to
   an initials monogram card and no detail line, which is exactly right for a
   newly-filled seat nobody has curated art for yet.
--------------------------------------------------------------------------- */
export interface Officer {
  name: string;
  role: string;
  detail: string;
  initials: string;
  featured?: boolean;
  /** Optional designed portrait card (4:5). Falls back to the initials
      monogram when absent. */
  photo?: string;
  /** Set when `photo` is a bare studio portrait rather than a designed card —
      it carries no name/role artwork, so the board deck draws its own. */
  plainPortrait?: boolean;
}

export type OfficerMeta = { detail: string; photo?: string; plainPortrait?: boolean };

export const OFFICER_META: Record<string, OfficerMeta> = {
  "adviser@icpep.se": { detail: "Faculty Adviser · CCpE, MSCpE", photo: "/board/amanda-abelardo-photo.jpg", plainPortrait: true },
  "president@icpep.se": { detail: "BS Computer Engineering – 4th Year", photo: "/board/archie-baltazar.jpg" },
  "vpea@icpep.se": { detail: "BS Computer Engineering – 3rd Year", photo: "/board/julia-mae-narne.jpg" },
  "vpia@icpep.se": { detail: "BS Computer Engineering – 3rd Year", photo: "/board/john-quelvin-rosales.jpg" },
  "secretary@icpep.se": { detail: "BS Computer Engineering – 3rd Year", photo: "/board/clint-kelvin-ignacio.jpg" },
  "assistant.secretary@icpep.se": { detail: "BS Computer Engineering – 3rd Year", photo: "/board/shyrra-mhay-poral.jpg" },
  "treasurer@icpep.se": { detail: "BS Computer Engineering – 4th Year", photo: "/board/hazel-rose-de-guzman.jpg" },
  "assistant.treasurer@icpep.se": { detail: "BS Computer Engineering – 3rd Year", photo: "/board/ma-kathleen-gutierrez.jpg" },
  "auditor@icpep.se": { detail: "BS Computer Engineering – 4th Year", photo: "/board/diana-lyn-sulit.jpg" },
  "pro@icpep.se": { detail: "BS Computer Engineering – 3rd Year", photo: "/board/jherylyn-cala.jpg" },
  "bod@icpep.se": { detail: "BS Computer Engineering – 3rd Year", photo: "/board/michaella-san-pedro.jpg" },
  "bod.2@icpep.se": { detail: "BS Computer Engineering – 3rd Year", photo: "/board/shieryl-martinez.jpg" },
  "bod.3@icpep.se": { detail: "BS Computer Engineering – 4th Year", photo: "/board/marc-julian.jpg" },
  "marielle@gmail.com": { detail: "BS Computer Engineering – 4th Year", photo: "/board/marielle-bauto.jpg" },
};

/** "Julia Mae D. Narne" → "JN" — first letter of the given name plus first
    letter of the surname, skipping single-letter middle initials ("D."). Only
    ever a fallback: every officer with curated art above never reaches this,
    and a card that does is a seat filled since. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => !/^[A-Za-z]\.$/.test(w));
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words[words.length - 1][0] ?? first;
  return (first + last).toUpperCase();
}

/* ---------------------------------------------------------------------------
   Teams
--------------------------------------------------------------------------- */
/** A team head or member. `photo` is optional — falls back to an initials
    avatar until a real image URL/path is provided. */


export interface TeamMember {
  name: string;
  year: string;
  photo?: string;
}

export interface Team {
  icon: LucideIcon;
  accent: string;
  name: string;
  head: string;
  /** Optional headshot for the team head. Falls back to an initials avatar. */
  headPhoto?: string;
  /** Year level of the team head (for the roster section). */
  headYear: string;
  members: string;
  desc: string;
  resp: string[];
  skills: string[];
  /** General members (excluding the head). */
  roster: TeamMember[];
}

export const TEAMS: Team[] = [
  {
    icon: Terminal,
    accent: "#ef4444",
    name: "Programming Team",
    head: "Czerina L. Piedad",
    headPhoto: "/team/czerina-piedad.jpg",
    headYear: "BS CpE – 4th Year",
    members: "8–12 members",
    desc: "The backbone of ICPEP's technical identity. Develops projects, competes in hackathons, and leads coding workshops for the whole chapter.",
    resp: ["Web development", "App development", "Competitive programming", "Technical workshops"],
    skills: ["One programming language", "Problem-solving", "Algorithmic thinking"],
    roster: [
      { name: "Dominic Andrew M. Alberto", year: "3rd Year", photo: "/team/dominic-alberto-v2.jpg" },
      { name: "Khurt Paul E. Anzures", year: "3rd Year", photo: "/team/khurt-anzures.jpg" },
      { name: "Ferose Hana M. Asuncion", year: "4th Year", photo: "/team/ferose-asuncion.jpg" },
      { name: "Merylle Joy G. Marquez", year: "4th Year", photo: "/team/merylle-marquez.jpg" },
    ],
  },
  {
    icon: Camera,
    accent: "#f59e0b",
    name: "Documentation Team",
    head: "John Exequiel B. Pascual",
    headPhoto: "/team/john-pascual.jpg",
    headYear: "BS CpE – 4th Year",
    members: "5–8 members",
    desc: "The eyes of ICPEP — captures every event through photos and videos, then edits and archives them into the visual memory of the chapter.",
    resp: ["Event photography", "Videography", "Photo & video editing", "Media archival"],
    skills: ["Photography & videography", "Photo/video editing", "Attention to detail"],
    roster: [
      { name: "Nicole Kimberly I. Acevedo", year: "3rd Year", photo: "/team/nicole-acevedo.jpg" },
      { name: "Felicisimo P. Esmeralda", year: "4th Year", photo: "/team/felicisimo-esmeralda.jpg" },
      { name: "Lhea Mae J. Esteban", year: "3rd Year", photo: "/team/lhea-esteban.jpg" },
      { name: "Marc Robert P. Torres", year: "3rd Year", photo: "/team/marc-torres.jpg" },
    ],
  },
  {
    icon: PenTool,
    accent: "#64748b",
    name: "Writers Team",
    head: "Charlene Faye R. Samaniego",
    headPhoto: "/team/charlene-samaniego.jpg",
    headYear: "BS CpE – 4th Year",
    members: "5–8 members",
    desc: "The voice of ICPEP — crafts announcements, social media captions, press releases, and creative content that carries the chapter's identity.",
    resp: ["Content creation", "Copywriting", "Newsletter"],
    skills: ["Creative writing", "Grammar proficiency", "Storytelling"],
    roster: [
      { name: "Cloiez Veniz L. Belmonte", year: "4th Year", photo: "/team/cloiez-belmonte.jpg" },
      { name: "Amyleanne Q. Cuerdo", year: "3rd Year", photo: "/team/amyleanne-cuerdo.jpg" },
      { name: "Kristine L. Panganiban", year: "4th Year", photo: "/team/kristine-panganiban.jpg" },
    ],
  },
  {
    icon: Share2,
    accent: "#ef4444",
    name: "Social Media Team",
    head: "Jhandell C. Alcantara",
    headPhoto: "/team/jhandell-alcantara.jpg",
    headYear: "BS CpE – 4th Year",
    members: "6–10 members",
    desc: "Manages ICPEP's digital presence across all platforms — from content scheduling to community engagement and analytics.",
    resp: ["Social media management", "Content scheduling", "Community engagement"],
    skills: ["Social media literacy", "Graphic design basics", "Trend awareness"],
    roster: [
      { name: "Hazel Mae M. Barcia", year: "3rd Year", photo: "/team/hazel-barcia.jpg" },
      { name: "Trisha Mae G. Domingo", year: "3rd Year", photo: "/team/trisha-domingo.jpg" },
      { name: "Ernalyn L. Galman", year: "3rd Year", photo: "/team/ernalyn-galman.jpg" },
      { name: "Nica Mae M. Galvez", year: "3rd Year", photo: "/team/nica-galvez.jpg" },
    ],
  },
  {
    icon: Clapperboard,
    accent: "#f59e0b",
    name: "Multimedia Team",
    head: "R Jay L. Villafuerte",
    headPhoto: "/team/rjay-villafuerte.jpg",
    headYear: "BS CpE – 3rd Year",
    members: "5–8 members",
    desc: "The creative force of ICPEP — designs graphics, posters, and visual content that give every event and announcement its polished, professional look.",
    resp: ["Graphic design", "Motion graphics", "Event posters & visuals", "Digital illustrations"],
    skills: ["Graphic design", "Visual storytelling", "Creativity"],
    roster: [
      { name: "Arian James M. Desiderio", year: "4th Year", photo: "/team/arian-desiderio.jpg" },
      { name: "John Vincent G. Roque", year: "3rd Year", photo: "/team/john-roque.jpg" },
      { name: "Justin D. San Antonio", year: "3rd Year", photo: "/team/justin-san-antonio.jpg" },
      { name: "Alessandra A. Taculao", year: "3rd Year", photo: "/team/alessandra-taculao.jpg" },
    ],
  },
  {
    icon: Gamepad2,
    accent: "#64748b",
    name: "E-sports Team",
    head: "Rex Gabriel M. Biazon",
    headPhoto: "/team/rex-biazon.jpg",
    headYear: "BS CpE – 4th Year",
    members: "8–15 members",
    desc: "Represents ICPEP in competitive gaming — builds school pride and fosters teamwork, discipline, and strategy through esports.",
    resp: ["Tournament participation", "Team practice", "Gaming event organization"],
    skills: ["Competitive gaming skill", "Teamwork", "Strategic thinking"],
    roster: [
      { name: "Arlan Reyniel F. Angel", year: "3rd Year", photo: "/team/arlan-angel.jpg" },
      { name: "Keith Ryan B. Delos Santos", year: "3rd Year", photo: "/team/keith-delos-santos.jpg" },
      { name: "Kalvin Vishnu M. Negapatan", year: "4th Year", photo: "/team/kalvin-negapatan.jpg" },
      { name: "Abegail Joiece C. Pogoy", year: "3rd Year", photo: "/team/abegail-pogoy.jpg" },
    ],
  },
];

/* ---------------------------------------------------------------------------
   Events
--------------------------------------------------------------------------- */
export type EventTone = "red" | "amber" | "slate";

export interface EventItem {
  name: string;
  month: string;
  venue: string;
  cat: string;
  tone: EventTone;
  desc: string;
  image: string;
}

/* Real ICpEP.SE BulSU–Meneses activities under Pres. Jeremiah (A.Y. 2025–2026),
   in the order they were conducted. Photos live in /public/events. */
export const EVENTS: EventItem[] = [
  { name: "CPE R3 Challenge Tryout: Programming Sprint", month: "October 2025", venue: "BulSU Meneses Campus", cat: "Competition", tone: "red", desc: "Timed coding sprint to select the chapter's representatives for the ICpEP.SE Regional 3 Challenge.", image: "/events/cpe-r3-tryout-sprint.jpg" },
  { name: "Innovation to Revolution: Arduino Basics & Overview", month: "October 2025", venue: "BulSU Meneses Campus", cat: "Workshop", tone: "amber", desc: "A hands-on introduction to Arduino microcontrollers and embedded systems in the world of emerging technology.", image: "/events/arduino-basics.jpg" },
  { name: "Artificial Intelligence Basics", month: "October 2025", venue: "BulSU Meneses Campus", cat: "Seminar", tone: "slate", desc: "A foundational seminar on artificial intelligence concepts and their growing role in engineering.", image: "/events/ai-basics.jpg" },
  { name: "Machine Learning", month: "October 2025", venue: "BulSU Meneses Campus", cat: "Seminar", tone: "slate", desc: "A deep dive into machine learning fundamentals, models, and their real-world engineering applications.", image: "/events/machine-learning.jpg" },
  { name: "CPE Challenge: Programming Sprint — Meneses Edition", month: "October 2025", venue: "BulSU Meneses Campus", cat: "Competition", tone: "red", desc: "The campus-wide programming sprint pitting Meneses CpE students against each other in a timed algorithmic showdown.", image: "/events/cpe-challenge-meneses.jpg" },
  { name: "BulSU Meneses Campus: Inter-Department League", month: "December 2025", venue: "BulSU Meneses Campus", cat: "League", tone: "amber", desc: "A friendly inter-department sports league fostering camaraderie and sportsmanship across the campus.", image: "/events/inter-department-league.jpg" },
  { name: "ICpEP.SE BulSU–MC R3 Challenge Tryouts", month: "February 2026", venue: "BulSU Meneses Campus", cat: "Competition", tone: "red", desc: "Selection tryouts for the delegates who will carry BulSU Meneses to the ICpEP.SE Regional 3 Challenge.", image: "/events/r3-challenge-tryouts.jpg" },
  { name: "CPE Exhibition & General Convocation", month: "May 2026", venue: "BulSU Meneses Campus", cat: "Major Event", tone: "red", desc: "The flagship \"Peaky Blinders: Crafting Tomorrow's Engineers\" showcase, capped by the general convocation.", image: "/events/cpe-exhibition-convocation.jpg" },
];

/* ---------------------------------------------------------------------------
   Gallery
--------------------------------------------------------------------------- */
export interface GalleryItem {
  id: number;
  title: string;
  category: string;
  icon: LucideIcon;
  pattern: "pat-diag" | "pat-dots" | "pat-grid";
  tint: string;
}

export const GALLERY_CATEGORIES = [
  "All",
  "Competitions",
  "Seminars",
  "Workshops",
  "Programming Month",
  "Outreach",
  "Team Building",
  "General Activities",
] as const;

export const GALLERY_ITEMS: GalleryItem[] = [
  { id: 1, title: "Algorithm Arena Finals", category: "Competitions", icon: Trophy, pattern: "pat-grid", tint: "rgba(220,38,38,0.18)" },
  { id: 2, title: "Regional Hackathon", category: "Competitions", icon: Code2, pattern: "pat-diag", tint: "rgba(220,38,38,0.10)" },
  { id: 3, title: "AI in Engineering Talk", category: "Seminars", icon: Monitor, pattern: "pat-dots", tint: "rgba(100,116,139,0.14)" },
  { id: 4, title: "Cybersecurity Seminar", category: "Seminars", icon: Lightbulb, pattern: "pat-grid", tint: "rgba(100,116,139,0.12)" },
  { id: 5, title: "Python Workshop", category: "Workshops", icon: Terminal, pattern: "pat-diag", tint: "rgba(245,158,11,0.12)" },
  { id: 6, title: "Web Dev Bootcamp", category: "Workshops", icon: Code2, pattern: "pat-dots", tint: "rgba(220,38,38,0.12)" },
  { id: 7, title: "Programming Month Kickoff", category: "Programming Month", icon: Sparkles, pattern: "pat-grid", tint: "rgba(220,38,38,0.20)" },
  { id: 8, title: "Code Sprint Night", category: "Programming Month", icon: Terminal, pattern: "pat-diag", tint: "rgba(245,158,11,0.10)" },
  { id: 9, title: "Awarding Ceremony", category: "Programming Month", icon: Award, pattern: "pat-dots", tint: "rgba(220,38,38,0.14)" },
  { id: 10, title: "Tech for Kids", category: "Outreach", icon: Heart, pattern: "pat-grid", tint: "rgba(245,158,11,0.14)" },
  { id: 11, title: "Community Coding Day", category: "Outreach", icon: Network, pattern: "pat-diag", tint: "rgba(245,158,11,0.10)" },
  { id: 12, title: "Team Building 2025", category: "Team Building", icon: Sparkles, pattern: "pat-dots", tint: "rgba(100,116,139,0.14)" },
  { id: 13, title: "Officers' Planning Retreat", category: "Team Building", icon: Target, pattern: "pat-grid", tint: "rgba(100,116,139,0.10)" },
  { id: 14, title: "General Assembly", category: "General Activities", icon: Sparkles, pattern: "pat-diag", tint: "rgba(220,38,38,0.10)" },
  { id: 15, title: "Weekly Team Meeting", category: "General Activities", icon: Monitor, pattern: "pat-dots", tint: "rgba(255,255,255,0.03)" },
];

/* ---------------------------------------------------------------------------
   Membership form fields
--------------------------------------------------------------------------- */
export const YEAR_LEVELS = ["3rd Year", "4th Year"];
export const SECTIONS = ["Section A", "Section B"];

/* ---------------------------------------------------------------------------
   FAQs
--------------------------------------------------------------------------- */
export const FAQS: { q: string; a: string }[] = [
  {
    q: "Who can join ICPEP?",
    a: "Membership is open to all Bachelor of Science in Computer Engineering students at BulSU Meneses Campus, regardless of year level. If you're enrolled in the CpE program, you're welcome here.",
  },
  {
    q: "Is there a membership fee?",
    a: "Yes. A membership fee of ₱75 is collected upon joining. This one-time contribution helps fund the organization's seminars, activities, and materials throughout the academic year, ensuring that every member benefits from the programs and opportunities ICpEP provides.",
  },
  {
    q: "Can I be part of multiple teams?",
    a: "No. To help members focus and contribute meaningfully, each member is assigned to a single team that best matches their skills and interests. This ensures that every team stays organized and that responsibilities are shared fairly across the organization.",
  },
  {
    q: "How often does ICpEP hold events?",
    a: "ICpEP does not hold events on a regular schedule. However, the organization conducts seminars and participates in major activities such as CPE Week, Programming Month, and R3 competition tryouts, along with other organization-related events.",
  },
  {
    q: "Will I get a certificate for participating?",
    a: "Yes. Certificates are issued for the seminars, workshops, and competitions you take part in — great additions to your résumé, scholarship applications, and professional portfolio.",
  },
  {
    q: "How do I stay updated on ICpEP activities?",
    a: "There is no official group chat. Members can stay updated by following the organization's official Facebook page, where announcements, events, and other updates are posted.",
  },
];

/* ---------------------------------------------------------------------------
   Contact
--------------------------------------------------------------------------- */
export const CONTACT = {
  facebook: "ICPEP – BulSU Meneses Campus",
  facebookUrl: "https://www.facebook.com/ICPEP.SEBulSUMC",
  email: "icpep.se.menesescampus@gmail.com",
  emailComposeUrl: "https://mail.google.com/mail/?view=cm&fs=1&to=icpep.se.menesescampus@gmail.com",
  location: "Triple Junction Subdivision (TJS) Matungao, Bulakan, Bulacan",
  mapEmbed:
    "https://www.google.com/maps?q=Bulacan+State+University+Meneses+Campus+Guiguinto+Bulacan&output=embed",
};
