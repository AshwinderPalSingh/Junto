import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ACTIVITIES } from "@/config/campus";
import { Icon } from "@/views/components/icons";
import { Logo } from "@/views/components/logo";

/** Photo-backed glass frame shared by the sign-in and verification forms. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-backdrop">
      <div className="auth-layout">
      <aside className="auth-story relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Image src="/images/thapar-main.webp" alt="Thapar's campus at dusk" fill loading="eager" fetchPriority="high" sizes="50vw" className="object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-[#281828]/35" />
        <Link href="/" className="relative">
          <Logo />
        </Link>
        <div className="relative">
          <div className="mb-10 grid w-fit grid-cols-5 gap-2">
            {ACTIVITIES.slice(0, 5).map((a, i) => (
              <span
                key={a.id}
                className="grid size-12 animate-float place-items-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md"
                style={{ animationDelay: `${i * 0.5}s` }}
              >
                <Icon name={a.icon} className="size-5" />
              </span>
            ))}
          </div>
          <h2 className="max-w-md text-[2.75rem] leading-[1.16] font-normal">
            Someone on campus wants to do the same thing, right now.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">Chai, walks, games, errands. One verified student, one plan, no pressure.</p>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-white/85">
          <ShieldCheck className="size-4" strokeWidth={1.75} /> Only verified campus emails can join.
        </p>
      </aside>
      <main className="auth-form flex min-w-0 flex-col px-6 py-7 sm:px-10">
        <Link href="/" className="lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="animate-glass-in">{children}</div>
        </div>
      </main>
      </div>
    </div>
  );
}
