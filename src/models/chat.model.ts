import "server-only";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, lt, ne, or } from "drizzle-orm";
import { getDb } from "./db/client";
import {
  chatMessages,
  conversationMembers,
  conversations,
  participations,
  plans,
  users,
  type ChatMessageRow,
  type ConversationRow,
  type PlanRow,
  type UserRow,
} from "./db/schema";

/** The single direct conversation between two members is keyed by their sorted ids. */
export const directKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export type MessageCursor = { at: Date; id: string };

export type InboxEntry = {
  conversation: ConversationRow;
  lastReadAt: Date;
  unread: number;
  last: ChatMessageRow | null;
  lastSender: UserRow | null;
  /** The other person, for direct chats. */
  other: UserRow | null;
  /** The plan, for plan group chats. */
  plan: PlanRow | null;
};

/**
 * Conversations, their members and messages. Authorisation (who may read or
 * write where) lives in the chat controller, using the pure rules in rules/chat.ts.
 */
export const ChatModel = {
  async get(id: string) {
    const db = await getDb();
    const [row] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return row ?? null;
  },

  async findDirect(a: string, b: string) {
    const db = await getDb();
    const [row] = await db.select().from(conversations).where(eq(conversations.directKey, directKey(a, b))).limit(1);
    return row ?? null;
  },

  async findForPlan(planId: string) {
    const db = await getDb();
    const [row] = await db.select().from(conversations).where(eq(conversations.planId, planId)).limit(1);
    return row ?? null;
  },

  /** Opens (creating once) the direct chat between two members. */
  async openDirect(creatorId: string, otherId: string) {
    const db = await getDb();
    const key = directKey(creatorId, otherId);
    return db.transaction(async (tx) => {
      await tx
        .insert(conversations)
        .values({ kind: "direct", directKey: key, createdBy: creatorId })
        .onConflictDoNothing({ target: conversations.directKey });
      const [conversation] = await tx.select().from(conversations).where(eq(conversations.directKey, key)).limit(1);
      await tx
        .insert(conversationMembers)
        .values([
          { conversationId: conversation.id, userId: creatorId },
          { conversationId: conversation.id, userId: otherId },
        ])
        .onConflictDoNothing();
      return conversation;
    });
  },

  /** How many direct chats a member started since `since` (anti-spam limit). */
  async countStartedSince(userId: string, since: Date) {
    const db = await getDb();
    const [row] = await db
      .select({ n: count() })
      .from(conversations)
      .where(and(eq(conversations.createdBy, userId), eq(conversations.kind, "direct"), gt(conversations.createdAt, since)));
    return row?.n ?? 0;
  },

  /**
   * Keeps a plan's group chat in step with the plan: members are the host and
   * accepted guests. The chat is created with the first accepted guest. Once a
   * plan is cancelled its membership freezes, so the history stays readable.
   */
  async syncPlan(planId: string): Promise<string | null> {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const [plan] = await tx
        .select({ id: plans.id, status: plans.status })
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1);
      if (!plan) return null;
      const [existing] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.planId, planId))
        .limit(1);
      if (plan.status === "cancelled" || plan.status === "expired") return existing?.id ?? null;

      const accepted = await tx
        .select({ userId: participations.userId, role: participations.role })
        .from(participations)
        .where(and(eq(participations.planId, planId), eq(participations.status, "accepted")));
      if (!existing && !accepted.some((a) => a.role === "guest")) return null;

      let id = existing?.id;
      if (!id) {
        await tx
          .insert(conversations)
          .values({ kind: "plan", planId })
          .onConflictDoNothing({ target: conversations.planId });
        const [row] = await tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.planId, planId))
          .limit(1);
        id = row.id;
      }

      const current = await tx
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, id));
      const want = new Set(accepted.map((a) => a.userId));
      const have = new Set(current.map((c) => c.userId));
      const add = [...want].filter((u) => !have.has(u));
      const remove = [...have].filter((u) => !want.has(u));
      if (add.length) {
        await tx
          .insert(conversationMembers)
          .values(add.map((userId) => ({ conversationId: id!, userId })))
          .onConflictDoNothing();
      }
      if (remove.length) {
        await tx
          .delete(conversationMembers)
          .where(and(eq(conversationMembers.conversationId, id), inArray(conversationMembers.userId, remove)));
      }
      return id;
    });
  },

  async membership(conversationId: string, userId: string) {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  async members(conversationId: string) {
    const db = await getDb();
    return db
      .select({ user: users, lastReadAt: conversationMembers.lastReadAt })
      .from(conversationMembers)
      .innerJoin(users, eq(users.id, conversationMembers.userId))
      .where(eq(conversationMembers.conversationId, conversationId))
      .orderBy(asc(conversationMembers.joinedAt));
  },

  /** A page of messages, oldest first, ending just before `before` (or at the newest). */
  async messages(conversationId: string, opts: { before?: MessageCursor; limit: number }) {
    const db = await getDb();
    const rows = await db
      .select({ message: chatMessages, sender: users })
      .from(chatMessages)
      .innerJoin(users, eq(users.id, chatMessages.senderId))
      .where(
        and(
          eq(chatMessages.conversationId, conversationId),
          opts.before
            ? or(
                lt(chatMessages.createdAt, opts.before.at),
                and(eq(chatMessages.createdAt, opts.before.at), lt(chatMessages.id, opts.before.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(opts.limit + 1);
    const hasEarlier = rows.length > opts.limit;
    return { rows: rows.slice(0, opts.limit).reverse(), hasEarlier };
  },

  /** Messages after `after` (catching up after a reconnect), oldest first. */
  async messagesAfter(conversationId: string, after: Date, limit = 100) {
    const db = await getDb();
    return db
      .select({ message: chatMessages, sender: users })
      .from(chatMessages)
      .innerJoin(users, eq(users.id, chatMessages.senderId))
      .where(and(eq(chatMessages.conversationId, conversationId), gt(chatMessages.createdAt, after)))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
      .limit(limit);
  },

  /** Stores a message; the sender has, by definition, read everything up to it. */
  async send(input: { conversationId: string; senderId: string; body: string; icon?: string | null }) {
    const db = await getDb();
    const now = new Date();
    return db.transaction(async (tx) => {
      const [message] = await tx
        .insert(chatMessages)
        .values({
          conversationId: input.conversationId,
          senderId: input.senderId,
          body: input.body,
          icon: input.icon ?? null,
          createdAt: now,
        })
        .returning();
      await tx.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, input.conversationId));
      await tx
        .update(conversationMembers)
        .set({ lastReadAt: now })
        .where(
          and(
            eq(conversationMembers.conversationId, input.conversationId),
            eq(conversationMembers.userId, input.senderId),
          ),
        );
      return message;
    });
  },

  async markRead(conversationId: string, userId: string) {
    const db = await getDb();
    await db
      .update(conversationMembers)
      .set({ lastReadAt: new Date() })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  },

  /** Unread messages from others, per conversation, for one member. */
  async unreadByConversation(userId: string, conversationIds?: readonly string[]) {
    const db = await getDb();
    const rows = await db
      .select({ conversationId: chatMessages.conversationId, n: count() })
      .from(chatMessages)
      .innerJoin(
        conversationMembers,
        and(
          eq(conversationMembers.conversationId, chatMessages.conversationId),
          eq(conversationMembers.userId, userId),
        ),
      )
      .where(
        and(
          ne(chatMessages.senderId, userId),
          gt(chatMessages.createdAt, conversationMembers.lastReadAt),
          conversationIds ? inArray(chatMessages.conversationId, [...conversationIds]) : undefined,
        ),
      )
      .groupBy(chatMessages.conversationId);
    return new Map(rows.map((r) => [r.conversationId, r.n]));
  },

  /** How many chats have unread messages (the nav badge). Blocked direct chats don't count. */
  async unreadConversationCount(userId: string, hiddenUserIds: ReadonlySet<string>) {
    const unread = await ChatModel.unreadByConversation(userId);
    if (unread.size === 0 || hiddenUserIds.size === 0) return unread.size;
    const db = await getDb();
    const hidden = await db
      .selectDistinct({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
      .where(
        and(
          inArray(conversationMembers.conversationId, [...unread.keys()]),
          eq(conversations.kind, "direct"),
          inArray(conversationMembers.userId, [...hiddenUserIds]),
        ),
      );
    return unread.size - hidden.length;
  },

  /**
   * The member's chats with at least one message, newest activity first.
   * Direct chats with someone either side has blocked are left out.
   */
  async inbox(userId: string, hiddenUserIds: ReadonlySet<string>, limit = 100): Promise<InboxEntry[]> {
    const db = await getDb();
    const mine = await db
      .select({ conversation: conversations, lastReadAt: conversationMembers.lastReadAt })
      .from(conversationMembers)
      .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
      .where(and(eq(conversationMembers.userId, userId), isNotNull(conversations.lastMessageAt)))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit);
    if (mine.length === 0) return [];
    const ids = mine.map((m) => m.conversation.id);
    const directIds = mine.filter((m) => m.conversation.kind === "direct").map((m) => m.conversation.id);
    const planIds = mine.flatMap((m) => (m.conversation.planId ? [m.conversation.planId] : []));

    const [lastRows, unread, others, planRows] = await Promise.all([
      db
        .selectDistinctOn([chatMessages.conversationId], { message: chatMessages, sender: users })
        .from(chatMessages)
        .innerJoin(users, eq(users.id, chatMessages.senderId))
        .where(inArray(chatMessages.conversationId, ids))
        .orderBy(chatMessages.conversationId, desc(chatMessages.createdAt), desc(chatMessages.id)),
      ChatModel.unreadByConversation(userId, ids),
      directIds.length
        ? db
            .select({ conversationId: conversationMembers.conversationId, user: users })
            .from(conversationMembers)
            .innerJoin(users, eq(users.id, conversationMembers.userId))
            .where(and(inArray(conversationMembers.conversationId, directIds), ne(conversationMembers.userId, userId)))
        : Promise.resolve([]),
      planIds.length ? db.select().from(plans).where(inArray(plans.id, planIds)) : Promise.resolve([]),
    ]);

    const lastBy = new Map(lastRows.map((r) => [r.message.conversationId, r]));
    const otherBy = new Map(others.map((o) => [o.conversationId, o.user]));
    const planBy = new Map(planRows.map((p) => [p.id, p]));
    return mine.flatMap(({ conversation, lastReadAt }) => {
      const other = otherBy.get(conversation.id) ?? null;
      if (conversation.kind === "direct" && (!other || hiddenUserIds.has(other.id))) return [];
      const last = lastBy.get(conversation.id);
      return [
        {
          conversation,
          lastReadAt,
          unread: unread.get(conversation.id) ?? 0,
          last: last?.message ?? null,
          lastSender: last?.sender ?? null,
          other,
          plan: conversation.planId ? (planBy.get(conversation.planId) ?? null) : null,
        },
      ];
    });
  },
};
