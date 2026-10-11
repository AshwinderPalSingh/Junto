import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarPlus,
  Eye,
  Flag,
  Handshake,
  HeartOff,
  MapPin,
  MessageCircle,
  Plus,
  ShieldCheck,
  UsersRound,
  Zap,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ACTIVITIES } from "@/config/campus";
import { APP } from "@/config/app";
import { cn } from "@/lib/utils";
import { Icon } from "@/views/components/icons";
import { Logo } from "@/views/components/logo";
import { Reveal } from "@/views/components/reveal";
import { ThemeToggle } from "@/views/components/theme-toggle";
import { Button } from "@/views/ui/button";
import "./landing.css";

const MODES = [
  {
    icon: CalendarPlus,
    title: "I have a plan",
    body: "Chai at six? Post it in ten seconds. People who are free, and comfortable with you, can ask to join.",
  },
  {
    icon: Zap,
    title: "I'm free",
    body: "No plan yet, just a free hour? Say so. You'll hear the moment a plan you'd like goes up.",
  },
  {
    icon: UsersRound,
    title: "Make it a group",
    body: "Badminton doubles, a study sprint or a market run. Groups fill faster and feel easier for a first meetup.",
  },
];

const STEPS = [
  { n: "01", title: "Find or post", body: "Browse plans happening now and later today, or post your own." },
  { n: "02", title: "Ask to join", body: "One tap. No essays, no small talk required." },
  { n: "03", title: "Both confirm", body: "The host accepts and you're in the plan's group chat to sort out details." },
  { n: "04", title: "Meet, then go", body: "Enjoy the activity. You don't owe anyone a follow-up chat." },
];

const TRUST = [
  { icon: BadgeCheck, title: "Verified campus only", body: `Every account is tied to a ${APP.campusShort} email address, confirmed with a one-time code.`, className: "sm:col-span-2" },
  { icon: MapPin, title: "Public spots only", body: "Plans happen at known public spots. Never hostels or cars." },
  { icon: Eye, title: "Real faces", body: "Everyone has one clear, recent photo, so you can recognise each other at the spot." },
  {
    icon: MessageCircle,
    title: "Chats on your terms",
    body: "Choose who can start a chat with you. Block or report from any chat, and they're gone.",
  },
  {
    icon: ShieldCheck,
    title: "Your boundaries, privately",
    body: "Choose who you're comfortable meeting. It filters plans quietly and never appears on your profile.",
    className: "sm:col-span-2",
  },
  {
    icon: Flag,
    title: "Block, report, leave",
    body: "Cancel for safety, block or report in one tap. Real people review every report.",
    className: "sm:col-span-2",
  },
  { icon: Handshake, title: "Reliability, not popularity", body: "We count showing up, not saying yes. Declining is always fine." },
];

const FAQ = [
  {
    q: "Is this a dating app?",
    a: "No. Junto is activity-first: you join a plan, not a person. There's no swiping, and chats are for sorting out plans. Treating it like a date gets accounts removed.",
  },
  {
    q: "Why is a profile photo required?",
    a: "So the people you meet can recognise you at the spot. It's the only photo we ask for, and only signed-in members of your campus can see it.",
  },
  {
    q: "Can anyone message me?",
    a: "Only members you could meet, and you decide: anyone, only people you've met on a plan, or nobody. Plan group chats are just for the people confirmed on that plan. Block or report anyone from the chat.",
  },
  {
    q: "Who can see who I'm comfortable meeting?",
    a: "Nobody. Your companion preferences filter which plans you see and who can see yours. They never appear on your profile.",
  },
  {
    q: "What if I accept and then can't make it?",
    a: "Cancel. Early cancellations are fine, late ones are noted, and safety cancellations never count against you.",
  },
  { q: "What does it cost?", a: "Nothing. Junto is free for students, and safety features always will be." },
];

export function LandingView() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <nav className="landing-nav" aria-label="Main">
          <Link href="/" className="landing-navBrand" aria-label={`${APP.name} home`}><Logo /></Link>
          <a href="#how" className="landing-navLink">How it works</a>
          <a href="#safety" className="landing-navLink">Safety</a>
          <Link href="/login" className="landing-navSignIn">Sign in <ArrowUpRight size={15} /></Link>
          <ThemeToggle className="landing-theme" />
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <Image src="/images/thapar-main.webp" alt="Thapar's campus building and open-air gathering space at dusk" fill loading="eager" fetchPriority="high" sizes="100vw" className="landing-heroPhoto" />
          <div className="landing-heroShade" aria-hidden="true" />
          <div className="landing-heroFrame" aria-hidden="true" />
          <div className="landing-heroContent">
            <p className="landing-heroBrand">{APP.campusShort}<span>{APP.tagline}</span></p>
            <h1 className="landing-heroTitle">{APP.name}</h1>
            <p className="landing-heroHeadline">Don&apos;t do it alone.<br />Find someone to do it with.</p>
            <div className="landing-heroMoment" aria-hidden="true">
              <span className="landing-photoChip"><Image src="/images/thapar-market.webp" alt="" fill sizes="140px" /></span>
              <MessageCircle size={30} strokeWidth={1.4} />
              <span>One plan. A little more together.</span>
            </div>
            <p className="landing-heroDescription">
              Chai at five, a walk after dinner, a run to the market. Junto connects you with verified students who
              are free right now, for one activity, with no pressure to keep talking after.
            </p>
            <div className="landing-heroActions">
              <Button asChild size="xl" className="landing-heroJoin"><Link href="/signup">Join with your {APP.campusShort} email <ArrowRight /></Link></Button>
              <a href="#how" className="landing-heroHow">How it works <ArrowRight size={16} /></a>
            </div>
          </div>
          <div className="landing-heroBottom">
            <p><BadgeCheck size={17} /> {APP.campusShort} community · verified students only</p>
            <ul>
              <li><HeartOff size={16} /> Not a dating app</li>
              <li><MessageCircle size={16} /> Chat to plan, then meet</li>
              <li><Eye size={16} /> Real photos, verified students</li>
            </ul>
          </div>
        </section>
        <section className="landing-features">
          <div className="landing-inner">
            <Reveal className="landing-sectionIntro">
              <p className="landing-eyebrow">A little company goes a long way</p>
              <h2>Your people. Your plans.<br /><span className="landing-highlight">All in one place.</span></h2>
              <p>One time, one public spot, people who are free right now.</p>
            </Reveal>
            <div className="landing-modeGrid">
            {MODES.map(({ icon: ModeIcon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.08}>
                <article className="landing-modeCard">
                  <div className="landing-modeTop"><span>0{i + 1}</span><ModeIcon size={22} strokeWidth={1.5} /></div>
                  <h3>{title}</h3>
                  <div className="landing-modePhoto"><Image src={["/images/thapar-market.webp", "/images/thapar-library.webp", "/images/thapar-main.webp"][i]} alt={["Students at a campus market", "A shared study table in the Thapar library", "Thapar's campus at dusk"][i]} fill sizes="(max-width: 700px) 90vw, 33vw" /></div>
                  <p>{body}</p>
                </article>
              </Reveal>
            ))}
            </div>
          </div>
        </section>
        <section id="how" className="landing-how">
          <div className="landing-inner">
            <Reveal className="landing-howIntro">
              <div><p className="landing-eyebrow">How it works</p><h2>The activity is the reason to meet.<br /><span>Friendship is optional.</span></h2></div>
              <p>Your community. Your activities.<br />One plan at a time.</p>
            </Reveal>
            <ol className="landing-steps">
              {STEPS.map((s, i) => (
                <li key={s.n}><Reveal delay={i * 0.08}><span>{s.n}</span><h3>{s.title}</h3><p>{s.body}</p></Reveal></li>
              ))}
            </ol>
            <Reveal className="landing-activities">
              <p className="landing-eyebrow">Things people do together</p>
              <div>
                {ACTIVITIES.map((a) => (
                  <span key={a.id}><Icon name={a.icon} className="size-5" />{a.label}</span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
        <section id="safety" className="landing-safety">
          <div className="landing-inner">
            <Reveal className="landing-sectionIntro"><p className="landing-eyebrow">Safety by design</p><h2>Built for meeting<br />new people <span className="landing-highlight">safely.</span></h2></Reveal>
            <div className="landing-trustGrid">
              {TRUST.map(({ icon: TrustIcon, title, body }, i) => (
                <Reveal key={title} delay={(i % 3) * 0.06}><article className="landing-trustItem"><span className="landing-trustIcon"><TrustIcon size={22} strokeWidth={1.5} /></span><div><h3>{title}</h3><p>{body}</p></div></article></Reveal>
              ))}
            </div>
            <Link href="/safety" className="landing-textLink">Community guidelines <ArrowRight size={17} /></Link>
          </div>
        </section>
        <section className="landing-difference">
          <div className="landing-inner">
            <Reveal><p className="landing-eyebrow">The difference</p><h2>Declining a chai invite just means you&apos;re busy.<br /><span>Nothing personal.</span></h2></Reveal>
            <div className="landing-comparison">
                {[
                  ["Dating apps", "Attraction · ongoing · rejection feels personal"],
                  ["Friend apps", "Shared interests · ongoing · slow to meet"],
                  [APP.name, "A specific plan, right now · 15 minutes to a few hours · no follow-up needed"],
                ].map(([k, v], i) => (
                  <div key={k} className={cn("landing-comparisonItem", i === 2 && "landing-comparisonJunto")}><p>{k}{i === 2 && <BadgeCheck size={20} />}</p><span>{v}</span></div>
                ))}
            </div>
          </div>
        </section>
        <section className="landing-questions">
          <div className="landing-inner">
            <Reveal><p className="landing-eyebrow">A few things you might be wondering</p><h2>Questions</h2></Reveal>
            <div className="landing-faq">
            {FAQ.map((f) => (
              <details key={f.q}><summary>{f.q}<Plus size={20} strokeWidth={1.5} /></summary><p>{f.a}</p></details>
            ))}
            </div>
          </div>
        </section>
        <section className="landing-join">
          <Image src="/images/thapar-market.webp" alt="Students spending time together at a Thapar campus market" fill sizes="100vw" className="landing-joinPhoto" />
          <div className="landing-joinShade" aria-hidden="true" />
          <Reveal className="landing-joinContent"><p className="landing-eyebrow">A little moment. A new connection.</p><h2>Your next little thing<br />is waiting.</h2><p>Setup takes a minute: your campus details, one photo, and who you&apos;re comfortable meeting.</p><Button asChild size="xl" className="landing-heroJoin"><Link href="/signup">Get started <ArrowRight /></Link></Button></Reveal>
        </section>
      </main>
      <footer className="landing-footer"><div className="landing-inner"><Logo /><p>Made for the {APP.campusShort} community. Activity first, always.</p><Link href="/safety">Community guidelines <ArrowRight size={15} /></Link></div></footer>
    </div>
  );
}
