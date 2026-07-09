import type { LucideIcon } from "lucide-react";
import {
  Award,
  Code2,
  FileText,
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
  Wrench,
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
  { id: "gallery", label: "Gallery" },
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
  label: string;
}[] = [
  { end: 150, suffix: "+", label: "Members" },
  { end: 6, label: "Teams" },
  { end: 20, suffix: "+", label: "Events" },
  { end: 2019, prefix: "Est. ", label: "Established" },
];

/* ---------------------------------------------------------------------------
   About
--------------------------------------------------------------------------- */
export const OBJECTIVES = [
  "Develop the technical and soft skills of Computer Engineering students through hands-on workshops, trainings, and mentorship.",
  "Build a strong, supportive community where members collaborate, share knowledge, and grow together.",
  "Represent BulSU Meneses Campus in regional and national competitions, hackathons, and ICPEP events.",
  "Prepare members for professional practice through industry talks, certifications, and career readiness programs.",
  "Serve the wider community through technology-driven outreach and volunteer initiatives.",
];

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
--------------------------------------------------------------------------- */
export interface Officer {
  name: string;
  role: string;
  detail: string;
  initials: string;
  featured?: boolean;
}

export const OFFICERS: Officer[] = [
  { name: "Engr. Marvin S. Dela Cruz", role: "Organization Adviser", detail: "Faculty Adviser · CpE Department", initials: "MD", featured: true },
  { name: "John Aldrin Santos", role: "President", detail: "BS Computer Engineering – 5th Year", initials: "JS" },
  { name: "Kristine Mae Villanueva", role: "Vice President", detail: "BS Computer Engineering – 5th Year", initials: "KV" },
  { name: "Angelica R. Ramos", role: "Secretary", detail: "BS Computer Engineering – 4th Year", initials: "AR" },
  { name: "Mark Joseph Bautista", role: "Treasurer", detail: "BS Computer Engineering – 4th Year", initials: "MB" },
  { name: "Patricia Anne Mercado", role: "Auditor", detail: "BS Computer Engineering – 4th Year", initials: "PM" },
  { name: "Carlo Miguel De Guzman", role: "Public Information Officer", detail: "BS Computer Engineering – 3rd Year", initials: "CD" },
];

/* ---------------------------------------------------------------------------
   Teams
--------------------------------------------------------------------------- */
export interface Team {
  icon: LucideIcon;
  accent: string;
  name: string;
  head: string;
  members: string;
  desc: string;
  resp: string[];
  skills: string[];
}

export const TEAMS: Team[] = [
  {
    icon: Terminal,
    accent: "#ef4444",
    name: "Programming Team",
    head: "Czerina Piedad",
    members: "8–12 members",
    desc: "The backbone of ICPEP's technical identity. Develops projects, competes in hackathons, and leads coding workshops for the whole chapter.",
    resp: ["Web development", "App development", "Competitive programming", "Technical workshops"],
    skills: ["One programming language", "Problem-solving", "Algorithmic thinking"],
  },
  {
    icon: FileText,
    accent: "#f59e0b",
    name: "Documentation Team",
    head: "Jasmine T. Reyes",
    members: "5–8 members",
    desc: "Ensures every event, activity, and decision is properly recorded and archived — the institutional memory of the organization.",
    resp: ["Meeting minutes", "Event documentation", "Report writing", "Archival"],
    skills: ["Technical writing", "Attention to detail", "Organization"],
  },
  {
    icon: PenTool,
    accent: "#64748b",
    name: "Writers Team",
    head: "Louise Gabriel Ocampo",
    members: "5–8 members",
    desc: "The voice of ICPEP — crafts announcements, social media captions, press releases, and creative content that carries the chapter's identity.",
    resp: ["Content creation", "Copywriting", "Newsletter", "Blog posts"],
    skills: ["Creative writing", "Grammar proficiency", "Storytelling"],
  },
  {
    icon: Share2,
    accent: "#ef4444",
    name: "Social Media Team",
    head: "Andrea Nicole Salvador",
    members: "6–10 members",
    desc: "Manages ICPEP's digital presence across all platforms — from content scheduling to community engagement and analytics.",
    resp: ["Social media management", "Content scheduling", "Community engagement", "Analytics"],
    skills: ["Social media literacy", "Graphic design basics", "Trend awareness"],
  },
  {
    icon: Wrench,
    accent: "#f59e0b",
    name: "Technical Team",
    head: "Rafael D. Manalastas",
    members: "5–8 members",
    desc: "Handles all technical logistics — AV setup, streaming, IT support, and equipment management during every event.",
    resp: ["Sound systems", "Projector setup", "Live streaming", "Troubleshooting"],
    skills: ["Technical troubleshooting", "Audio-visual knowledge", "Adaptability"],
  },
  {
    icon: Gamepad2,
    accent: "#64748b",
    name: "E-sports Team",
    head: "Joshua Emmanuel Cruz",
    members: "8–15 members",
    desc: "Represents ICPEP in competitive gaming — builds school pride and fosters teamwork, discipline, and strategy through esports.",
    resp: ["Tournament participation", "Team practice", "Gaming event organization"],
    skills: ["Competitive gaming skill", "Teamwork", "Strategic thinking"],
  },
];

/* ---------------------------------------------------------------------------
   Events
--------------------------------------------------------------------------- */
export type EventTone = "red" | "amber" | "slate";

export interface EventItem {
  name: string;
  date: string;
  venue: string;
  cat: string;
  tone: EventTone;
  desc: string;
}

export const EVENTS: EventItem[] = [
  { name: "Intro to Python Workshop", date: "Feb 14, 2025", venue: "Computer Lab 2", cat: "Workshop", tone: "red", desc: "A zero-to-hero session covering Python basics, culminating in a mini text-based game build." },
  { name: "Web Dev Bootcamp", date: "Mar 7–8, 2025", venue: "AVR, Meneses Campus", cat: "Workshop", tone: "red", desc: "Two-day intensive on HTML, CSS, JavaScript, and deploying a personal portfolio site." },
  { name: "ICPEP Week 2025", date: "Apr 21–25, 2025", venue: "Campus Grounds", cat: "Major Event", tone: "red", desc: "A week-long celebration of computer engineering: exhibits, games, quiz bees, and the general assembly." },
  { name: "Coding Challenge: Algorithm Arena", date: "May 16, 2025", venue: "Computer Lab 1", cat: "Competition", tone: "amber", desc: "Timed algorithmic problem-solving showdown. Top three advance to the regional eliminations." },
  { name: "Tech Talk: AI in Engineering", date: "Jun 20, 2025", venue: "AVR, Meneses Campus", cat: "Seminar", tone: "slate", desc: "Industry speakers on how machine learning is reshaping engineering practice in the Philippines." },
  { name: "Community Outreach: Tech for Kids", date: "Jul 12, 2025", venue: "Guiguinto Elementary School", cat: "Outreach", tone: "amber", desc: "Members teach basic computer literacy and Scratch programming to grade-school students." },
  { name: "Team Building 2025", date: "Aug 9, 2025", venue: "Norzagaray, Bulacan", cat: "Team Building", tone: "slate", desc: "A full day of games, challenges, and bonding to kick off the new academic year as one chapter." },
  { name: "Seminar: Cybersecurity Fundamentals", date: "Sep 19, 2025", venue: "AVR, Meneses Campus", cat: "Seminar", tone: "slate", desc: "Threats, defenses, and ethical hacking basics — with a live demonstration of common attack vectors." },
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
export const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
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
    a: "Yes, a minimal membership fee is collected to fund the organization's activities, events, and materials. The exact amount may vary per academic year and is always announced transparently before collection.",
  },
  {
    q: "Do I need coding experience to join?",
    a: "Not at all! ICPEP welcomes all skill levels. We run workshops, trainings, and mentorship programs specifically designed to help beginners grow — many of our best members started with zero experience.",
  },
  {
    q: "Can I be part of multiple teams?",
    a: "Yes. Members can participate in more than one team based on their interests and availability. Many members contribute to both a technical team and a creative or events team.",
  },
  {
    q: "How often does ICPEP hold events?",
    a: "Regularly — from weekly team meetings to monthly seminars and workshops, plus major flagship events every semester such as ICPEP Week and Programming Month.",
  },
  {
    q: "Will I get a certificate for participating?",
    a: "Yes. Certificates are issued for the seminars, workshops, and competitions you take part in — great additions to your résumé, scholarship applications, and professional portfolio.",
  },
  {
    q: "How do I stay updated on ICPEP activities?",
    a: "Follow our official Facebook page for announcements, and join our members' group chat once you've completed your membership. That's where schedules, reminders, and opportunities are shared first.",
  },
];

/* ---------------------------------------------------------------------------
   Contact
--------------------------------------------------------------------------- */
export const CONTACT = {
  facebook: "ICPEP – BulSU Meneses Campus",
  facebookUrl: "#",
  email: "icpep.meneses@bulsu.edu.ph",
  location: "Bulacan State University – Meneses Campus, Guiguinto, Bulacan",
  mapEmbed:
    "https://www.google.com/maps?q=Bulacan+State+University+Meneses+Campus+Guiguinto+Bulacan&output=embed",
};
