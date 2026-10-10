import { ArrowLeft, Ban, BadgeCheck, Eye, Flag, LifeBuoy, MapPin, MessageCircle, Phone, Share2, UserX } from "lucide-react";
import Link from "next/link";
import { APP } from "@/config/app";
import { COMMUNITY_GUIDELINES } from "@/config/safety";
import { Logo } from "@/views/components/logo";
import { Reveal } from "@/views/components/reveal";

const TIPS = [
  {
    icon: MapPin,
    title: "Stick to the spot",
    body: "Meet only at the public spot on the plan. Don't move somewhere private or get into a vehicle.",
  },
  {
    icon: Share2,
    title: "Tell someone",
    body: "Use “Share with a trusted contact” on any confirmed plan. They get a read-only link, no account needed.",
  },
  {
    icon: UserX,
    title: "Leave whenever",
    body: "You never owe anyone more time. Cancel for safety at any point and it never counts against you.",
  },
  {
    icon: Eye,
    title: "Check the photo",
    body: "Every member has one clear photo, so you can recognise each other. If someone doesn't match it, flag it.",
  },
  {
    icon: MessageCircle,
    title: "Keep chats about the plan",
    body: "Chat to sort out where and when. If someone pushes to meet somewhere private, gets personal or won't take no, block and report them.",
  },
  {
    icon: Flag,
    title: "Report anything off",
    body: "Unwanted attention, pressure, or a fake profile: report it. A real person reviews every report.",
  },
  {
    icon: Ban,
    title: "Block quietly",
    body: "Blocking hides you from each other's plans, profiles and chats. They aren't told.",
  },
];

/** Public safety centre and community guidelines. */
export function SafetyView() {
  return (
    <div className="mx-auto max-w-3xl px-5 pt-6 pb-20">
      <header className="flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <Link
          href="/board"
          className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" /> Back to {APP.name}
        </Link>
      </header>

      <section className="mt-14 animate-glass-in">
        <span className="grid size-12 place-items-center bg-primary text-primary-foreground">
          <LifeBuoy className="size-6" strokeWidth={1.5} />
        </span>
        <p className="mt-6 label-caps text-muted-foreground">Safety</p>
        <h1 className="mt-2 text-5xl leading-[1.02] tracking-[-0.045em] sm:text-6xl">Safety centre</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          {APP.name} connects verified students for everyday activities. These habits keep it safe and low-pressure.
        </p>
      </section>

      <section className="glass mt-10 flex animate-glass-in gap-4 border-destructive/35 p-5">
        <Phone className="mt-0.5 size-6 shrink-0 text-destructive" strokeWidth={1.75} />
        <div>
          <p className="font-semibold">In an emergency, call 112 first.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            112 is India&apos;s national emergency number. Then contact campus security. Report it in {APP.name}{" "}
            afterwards so a moderator can act.
          </p>
        </div>
      </section>

      <section className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2">
        {TIPS.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} delay={i * 0.04}>
            <article className="group h-full bg-background/80 p-6 backdrop-blur-md transition-colors hover:bg-accent/60">
              <Icon className="size-5 transition-transform group-hover:-translate-y-0.5" strokeWidth={1.5} />
              <h2 className="mt-4 text-lg tracking-[-0.02em]">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </article>
          </Reveal>
        ))}
      </section>

      <section className="mt-16">
        <p className="label-caps text-muted-foreground">Ground rules</p>
        <h2 className="mt-2 text-3xl tracking-[-0.035em]">Community guidelines</h2>
        <ol className="glass mt-6 divide-y divide-border">
          {COMMUNITY_GUIDELINES.map((g, i) => (
            <li key={g.title} className="flex gap-5 p-5">
              <span className="font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="block font-semibold">{g.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{g.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Reveal>
        <section className="glass-strong mt-16 p-6 sm:p-8">
          <BadgeCheck className="size-6" strokeWidth={1.5} />
          <h2 className="mt-4 text-xl tracking-[-0.025em]">How we keep the community verified</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {[
              `Only ${APP.campusShort} email addresses can join, confirmed with a one-time code.`,
              "Members must be 18 or older and agree to these guidelines.",
              "Everyone has exactly one clear profile photo, and moderators review new photos.",
              "Gender is locked after setup so preferences can't be gamed.",
              "Reports, no-show patterns and suspensions are handled by real people.",
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 bg-foreground" />
                {line}
              </li>
            ))}
          </ul>
        </section>
      </Reveal>
    </div>
  );
}
