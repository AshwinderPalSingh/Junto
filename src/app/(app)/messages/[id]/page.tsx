import type { Metadata } from "next";
import { Suspense } from "react";
import { loadEarlierMessages, loadNewMessages, markChatRead, sendChatMessage } from "@/controllers/chat.actions";
import { ChatController } from "@/controllers/chat.controller";
import { blockMember, reportMember } from "@/controllers/safety.actions";
import { PageSkeleton } from "@/views/components/skeletons";
import { ConversationView } from "@/views/screens/chat/conversation-view";

export const metadata: Metadata = { title: "Chat" };

/** Router: GET /messages/:id → ChatController.conversation → ConversationView (actions bound to this chat) */
export default function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ConversationContent params={params} />
    </Suspense>
  );
}

async function ConversationContent({ params }: Pick<PageProps<"/messages/[id]">, "params">) {
  const vm = await ChatController.conversation(params);
  const id = vm.thread.conversationId;
  return (
    <ConversationView
      // A different chat is a different thread: never carry state across.
      key={id}
      vm={vm}
      actions={{
        send: sendChatMessage.bind(null, id),
        markRead: markChatRead.bind(null, id),
        loadEarlier: loadEarlierMessages.bind(null, id),
        loadNew: loadNewMessages.bind(null, id),
      }}
      safety={{ reportMember, blockMember }}
    />
  );
}
