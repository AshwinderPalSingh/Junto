import { Suspense } from "react";
import { ShellController } from "@/controllers/shell.controller";
import { LiveEvents } from "@/views/components/live-events";
import { AppShell } from "@/views/layouts/app-shell";
import { AdminLinkView, AvatarView, BellView, MessagesBadgeView, MessagesLinkView } from "@/views/layouts/shell-slots";

/**
 * Signed-in app chrome. The frame is static (prerendered); the per-member bits
 * (unread badge, avatar, moderation link) stream in behind Suspense.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      bell={
        <Suspense fallback={<BellView shell={null} />}>
          <Bell />
        </Suspense>
      }
      messages={
        <Suspense fallback={<MessagesLinkView shell={null} />}>
          <MessagesLink />
        </Suspense>
      }
      messagesBadge={
        <Suspense fallback={null}>
          <MessagesBadge />
        </Suspense>
      }
      avatar={
        <Suspense fallback={<AvatarView shell={null} />}>
          <Avatar />
        </Suspense>
      }
      adminLink={
        <Suspense fallback={null}>
          <AdminLink />
        </Suspense>
      }
      live={<LiveEvents />}
    >
      {children}
    </AppShell>
  );
}

async function Bell() {
  return <BellView shell={await ShellController.data()} />;
}

async function MessagesLink() {
  return <MessagesLinkView shell={await ShellController.data()} />;
}

async function MessagesBadge() {
  return <MessagesBadgeView shell={await ShellController.data()} />;
}

async function Avatar() {
  return <AvatarView shell={await ShellController.data()} />;
}

async function AdminLink() {
  return <AdminLinkView shell={await ShellController.data()} />;
}
