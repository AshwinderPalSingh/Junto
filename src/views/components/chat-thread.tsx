"use client";

import { ArrowDown, RotateCw, SendHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RULES } from "@/config/app";
import { MESSAGE_PRESETS } from "@/config/safety";
import type { ActionState } from "@/lib/action";
import { formatClock, formatDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Icon } from "@/views/components/icons";
import { MemberAvatar } from "@/views/components/member-avatar";
import { Button } from "@/views/ui/button";
import { Spinner } from "@/views/ui/spinner";
import { Textarea } from "@/views/ui/textarea";
import type { ChatMessageVM, ChatThreadVM } from "@/views/view-models";

export type ChatActions = {
  send: (input: { body: string; icon?: string | null }) => Promise<ActionState<{ message: ChatMessageVM }>>;
  markRead: () => Promise<void>;
  loadEarlier: (before: { at: string; id: string }) => Promise<{ messages: ChatMessageVM[]; hasEarlier: boolean }>;
  loadNew: (after: string) => Promise<ChatMessageVM[]>;
};

/** Dispatched on window by LiveEvents for every chat message this member receives. */
export type ChatEventDetail = { conversationId: string; message: ChatMessageVM | null };
export const CHAT_EVENT = "junto:chat";
export const RECONNECTED_EVENT = "junto:reconnected";

type Pending = { key: string; body: string; icon: string | null; failed: string | null };

const GROUP_GAP_MS = 5 * 60_000;

function mergeMessages(list: ChatMessageVM[], incoming: readonly ChatMessageVM[]) {
  if (incoming.length === 0) return list;
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => (a.at === b.at ? (a.id < b.id ? -1 : 1) : a.at < b.at ? -1 : 1));
}

/** Messages grouped by day, then into runs from the same sender a few minutes apart. */
function groupMessages(messages: readonly ChatMessageVM[], now: string) {
  const days: { key: string; label: string; runs: ChatMessageVM[][] }[] = [];
  for (const m of messages) {
    const label = formatDay(m.at, now);
    let day = days.at(-1);
    if (!day || day.label !== label) {
      day = { key: m.id, label, runs: [] };
      days.push(day);
    }
    const run = day.runs.at(-1);
    const prev = run?.at(-1);
    if (run && prev && prev.senderId === m.senderId && Date.parse(m.at) - Date.parse(prev.at) < GROUP_GAP_MS) run.push(m);
    else day.runs.push([m]);
  }
  return days;
}

type Mode = "page" | "panel";

/** The element that scrolls: the panel itself, or the whole page. */
const scrollerFor = (mode: Mode, panel: HTMLElement | null) =>
  mode === "panel" ? panel : (document.scrollingElement as HTMLElement | null);

function isNearBottom(mode: Mode, panel: HTMLElement | null) {
  const el = scrollerFor(mode, panel);
  if (!el) return true;
  const visible = mode === "panel" ? el.clientHeight : window.innerHeight;
  return el.scrollHeight - el.scrollTop - visible < (mode === "panel" ? 120 : 260);
}

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g;

function MessageText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Bubble({
  mine,
  icon,
  children,
  state,
}: {
  mine: boolean;
  icon: string | null;
  children: React.ReactNode;
  state?: "sending" | "failed";
}) {
  return (
    <div
      className={cn(
        "w-fit max-w-full rounded-[1.15rem] px-3.5 py-2 text-[0.94rem] leading-snug break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
        mine
          ? "bg-primary text-primary-foreground"
          : "border border-[var(--glass-edge)] bg-[var(--glass-fill-strong)] text-foreground shadow-[0_1px_2px_var(--glass-shadow-near)]",
        state === "sending" && "opacity-60",
        state === "failed" && "border border-destructive/50 bg-destructive/10 text-foreground",
      )}
    >
      {icon && <Icon name={icon} className="mr-1.5 mb-0.5 inline size-4 align-middle" />}
      {children}
    </div>
  );
}

export function ChatThread({
  thread,
  now,
  actions,
  mode = "page",
  quickUpdates = false,
  emptyHint,
}: {
  thread: ChatThreadVM;
  now: string;
  actions: ChatActions;
  /** "page": the chat fills the screen (window scroll). "panel": a fixed-height box inside another page. */
  mode?: Mode;
  /** One-tap meetup updates (plan chats). */
  quickUpdates?: boolean;
  emptyHint?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(thread.messages);
  const [serverMessages, setServerMessages] = useState(thread.messages);
  const [hasEarlier, setHasEarlier] = useState(thread.hasEarlier);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState("");
  const [unseen, setUnseen] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const opened = useRef(false);
  const restore = useRef<{ height: number; top: number } | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isGroup = thread.kind === "plan";

  // A server re-render (router.refresh) may bring messages we already have, or ones we missed.
  if (serverMessages !== thread.messages) {
    setServerMessages(thread.messages);
    setMessages((cur) => mergeMessages(cur, thread.messages));
  }

  const nearBottom = () => isNearBottom(mode, listRef.current);
  const scrollToBottom = (smooth: boolean) => {
    const el = scrollerFor(mode, listRef.current);
    el?.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };
  const jumpToNewest = () => {
    scrollToBottom(true);
    setUnseen(0);
  };

  // Keep the view pinned to the newest message, or keep the reader's place when loading older ones.
  useLayoutEffect(() => {
    const el = scrollerFor(mode, listRef.current);
    if (!el) return;
    if (restore.current) {
      el.scrollTop = restore.current.top + (el.scrollHeight - restore.current.height);
      restore.current = null;
    } else if (stickToBottom.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: opened.current ? "smooth" : "auto" });
    }
    opened.current = true;
  }, [messages, pending, mode]);

  const markRead = useEffectEvent(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (document.visibilityState === "visible") actions.markRead().catch(() => {});
    }, 500);
  });

  // Opening the chat reads it; refresh once so the unread badges update.
  const onOpen = useEffectEvent(() => {
    if (thread.unreadOnOpen === 0) return;
    actions
      .markRead()
      .then(() => router.refresh())
      .catch(() => {});
  });
  useEffect(() => {
    onOpen();
  }, []);

  const receive = useEffectEvent((incoming: readonly ChatMessageVM[]) => {
    if (incoming.length === 0) return;
    const fresh = incoming.filter((m) => !messages.some((x) => x.id === m.id));
    stickToBottom.current = nearBottom();
    setMessages((cur) => mergeMessages(cur, incoming));
    const fromOthers = fresh.filter((m) => !m.mine).length;
    if (fromOthers > 0) {
      if (!stickToBottom.current) setUnseen((n) => n + fromOthers);
      markRead();
    }
  });

  const catchUp = useEffectEvent(async () => {
    const last = messages.at(-1);
    try {
      receive(await actions.loadNew(last?.at ?? new Date(0).toISOString()));
    } catch {
      // The next live update or refresh will bring it.
    }
  });

  useEffect(() => {
    const onChat = (event: Event) => {
      const detail = (event as CustomEvent<ChatEventDetail>).detail;
      if (detail.conversationId !== thread.conversationId) return;
      if (detail.message) receive([detail.message]);
      else void catchUp();
    };
    const onReconnect = () => void catchUp();
    const onVisible = () => {
      if (document.visibilityState === "visible") markRead();
    };
    window.addEventListener(CHAT_EVENT, onChat);
    window.addEventListener(RECONNECTED_EVENT, onReconnect);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(CHAT_EVENT, onChat);
      window.removeEventListener(RECONNECTED_EVENT, onReconnect);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(readTimer.current);
    };
  }, [thread.conversationId]);

  // Panel mode: hide the "new messages" pill once the reader scrolls down.
  const onPanelScroll = () => {
    if (unseen > 0 && nearBottom()) setUnseen(0);
  };
  const onWindowScroll = useEffectEvent(() => {
    if (unseen > 0 && nearBottom()) setUnseen(0);
  });
  useEffect(() => {
    if (mode !== "page") return;
    const onScroll = () => onWindowScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode]);

  async function loadEarlier() {
    const first = messages[0];
    if (!first || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const page = await actions.loadEarlier({ at: first.at, id: first.id });
      const el = scrollerFor(mode, listRef.current);
      if (el) restore.current = { height: el.scrollHeight, top: el.scrollTop };
      stickToBottom.current = false;
      setMessages((cur) => mergeMessages(cur, page.messages));
      setHasEarlier(page.hasEarlier);
    } catch {
      toast.error("Couldn't load older messages. Try again.");
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function deliver(item: Pending) {
    try {
      const result = await actions.send({ body: item.body, icon: item.icon });
      if (result.status === "success" && result.data) {
        stickToBottom.current = true;
        setPending((cur) => cur.filter((p) => p.key !== item.key));
        setMessages((cur) => mergeMessages(cur, [result.data!.message]));
      } else {
        const reason = result.status === "error" ? result.message : "Not sent.";
        setPending((cur) => cur.map((p) => (p.key === item.key ? { ...p, failed: reason } : p)));
      }
    } catch {
      setPending((cur) =>
        cur.map((p) => (p.key === item.key ? { ...p, failed: "No connection. Tap to retry." } : p)),
      );
    }
  }

  function send(body: string, icon: string | null = null) {
    const text = body.trim();
    if (!text || !thread.canSend) return;
    const item: Pending = { key: crypto.randomUUID(), body: text.slice(0, RULES.chat.maxLength), icon, failed: null };
    stickToBottom.current = true;
    setPending((cur) => [...cur, item]);
    void deliver(item);
  }

  function retry(item: Pending) {
    const fresh = { ...item, failed: null };
    setPending((cur) => cur.map((p) => (p.key === item.key ? fresh : p)));
    void deliver(fresh);
  }

  function submitDraft() {
    if (!draft.trim()) return;
    send(draft);
    setDraft("");
    inputRef.current?.focus();
  }

  const days = groupMessages(messages, now);
  const remaining = RULES.chat.maxLength - draft.length;

  const list = (
    <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages" className="space-y-5">
      {hasEarlier && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={loadEarlier} disabled={loadingEarlier}>
            {loadingEarlier ? <Spinner /> : null} Load earlier messages
          </Button>
        </div>
      )}
      {messages.length === 0 && pending.length === 0 && (
        <p className="mx-auto max-w-xs py-10 text-center text-sm text-muted-foreground">
          {emptyHint ?? "No messages yet. Say hi."}
        </p>
      )}
      {days.map((day) => (
        <section key={day.key} className="space-y-3">
          <p className="text-center text-[0.72rem] font-medium text-muted-foreground">{day.label}</p>
          {day.runs.map((run) => {
            const first = run[0];
            const mine = first.mine;
            return (
              <div key={first.id} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                {!mine && <MemberAvatar photo={first.senderPhoto} name={first.senderName} size="sm" />}
                <div className={cn("flex max-w-[80%] min-w-0 flex-col gap-1", mine ? "items-end" : "items-start")}>
                  {!mine && isGroup && <p className="px-3 text-xs font-medium text-muted-foreground">{first.senderName}</p>}
                  {run.map((m) => (
                    <Bubble key={m.id} mine={mine} icon={m.icon}>
                      <MessageText text={m.body} />
                    </Bubble>
                  ))}
                  <time dateTime={run.at(-1)!.at} className="px-1.5 text-[0.68rem] text-muted-foreground">
                    {formatClock(run.at(-1)!.at)}
                  </time>
                </div>
              </div>
            );
          })}
        </section>
      ))}
      {pending.length > 0 && (
        <div className="flex flex-col items-end gap-1">
          {pending.map((p) => (
            <div key={p.key} className="flex max-w-[80%] flex-col items-end gap-1">
              <Bubble mine icon={p.icon} state={p.failed ? "failed" : "sending"}>
                {p.body}
              </Bubble>
              {p.failed ? (
                <span className="flex items-center gap-2 px-1 text-[0.72rem] text-destructive">
                  {p.failed}
                  <button type="button" onClick={() => retry(p)} className="inline-flex items-center gap-1 font-medium underline">
                    <RotateCw className="size-3" /> Retry
                  </button>
                  <button
                    type="button"
                    aria-label="Discard message"
                    onClick={() => setPending((cur) => cur.filter((x) => x.key !== p.key))}
                    className="text-muted-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : (
                <span className="px-1.5 text-[0.68rem] text-muted-foreground">Sending…</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const composer = thread.canSend ? (
    <div className="space-y-2">
      {quickUpdates && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none">
          {MESSAGE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if ("needsDetail" in p) {
                  setDraft(`${p.text} `);
                  inputRef.current?.focus();
                } else {
                  send(p.text, p.icon);
                }
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--glass-edge)] bg-[var(--glass-fill)] px-3 text-xs font-medium text-foreground backdrop-blur-md transition-colors hover:bg-accent"
            >
              <Icon name={p.icon} className="size-3.5" />
              {p.text}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitDraft();
        }}
        className="flex items-end gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Desktop: Enter sends, Shift+Enter adds a line. Phones keep Enter for new lines.
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                window.matchMedia("(pointer: fine)").matches
              ) {
                e.preventDefault();
                submitDraft();
              }
            }}
            rows={1}
            maxLength={RULES.chat.maxLength}
            placeholder="Message"
            aria-label="Message"
            className="max-h-40 min-h-11 resize-none rounded-[1.4rem] bg-[var(--glass-fill-strong)] py-2.5 pr-4 pl-4"
          />
          {remaining <= 100 && (
            <span className="absolute -top-5 right-2 text-[0.68rem] text-muted-foreground">{remaining}</span>
          )}
        </div>
        <Button type="submit" size="icon-lg" disabled={!draft.trim()} aria-label="Send message" className="shrink-0">
          <SendHorizontal />
        </Button>
      </form>
    </div>
  ) : (
    <p className="rounded-2xl border border-border bg-muted/60 px-4 py-3 text-center text-sm text-muted-foreground">
      {thread.closedReason ?? "You can't send messages here."}
    </p>
  );

  const newPill =
    unseen > 0 ? (
      <div className="pointer-events-none flex justify-center">
        <button
          type="button"
          onClick={jumpToNewest}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-lg"
        >
          <ArrowDown className="size-3.5" /> {unseen} new {unseen === 1 ? "message" : "messages"}
        </button>
      </div>
    ) : null;

  if (mode === "panel") {
    return (
      <div className="space-y-3">
        <div className="relative">
          <div
            ref={listRef}
            onScroll={onPanelScroll}
            className="max-h-[26rem] min-h-40 overflow-y-auto overscroll-contain px-1 py-2"
          >
            {list}
          </div>
          {newPill && <div className="absolute inset-x-0 bottom-2">{newPill}</div>}
        </div>
        {composer}
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-20rem)] flex-col lg:min-h-[calc(100dvh-17rem)]">
      <div className="flex-1 pb-4">{list}</div>
      <div className="sticky bottom-24 z-10 space-y-2 lg:bottom-4">
        {newPill}
        <div className="glass-strong rounded-[1.6rem] p-2.5">{composer}</div>
      </div>
    </div>
  );
}
