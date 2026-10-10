import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMinutes, campusTimeToDate } from "@/lib/time";
import { BlockModel } from "@/models/block.model";
import { ChatModel, directKey } from "@/models/chat.model";
import type { UserRow } from "@/models/db/schema";
import { PlanModel } from "@/models/plan.model";
import { canSendDirect, canSendInPlan, canStartDirectChat, type ChatPerson } from "@/models/rules/chat";
import { closeDatabase, makeMember, useFreshDatabase } from "./helpers/db";

const ALL = ["woman", "man", "nonbinary"];
// 10:00 campus time on a fixed day keeps every plan inside campus hours.
const NOW = campusTimeToDate(new Date("2026-10-12T00:00:00Z"), 0, "10:00");

const person = (id: string, over: Partial<ChatPerson> = {}): ChatPerson => ({
  id,
  status: "active",
  onboarded: true,
  gender: "woman",
  companionGenders: ALL,
  chatPolicy: "anyone",
  ...over,
});
const free = { blocked: false, haveMet: false };

describe("who may start a direct chat", () => {
  it("allows members who could meet", () => {
    expect(canStartDirectChat(person("a"), person("b"), free)).toEqual({ ok: true });
  });

  it("never reveals blocks or private comfort preferences", () => {
    expect(canStartDirectChat(person("a"), person("b"), { ...free, blocked: true })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    const onlyWomen = person("b", { companionGenders: ["woman"] });
    expect(canStartDirectChat(person("a", { gender: "man" }), onlyWomen, free)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("lets people who met on a plan reach each other", () => {
    const onlyWomen = person("b", { companionGenders: ["woman"] });
    expect(canStartDirectChat(person("a", { gender: "man" }), onlyWomen, { ...free, haveMet: true })).toEqual({ ok: true });
  });

  it("respects each member's chat setting", () => {
    expect(canStartDirectChat(person("a"), person("b", { chatPolicy: "nobody" }), free)).toEqual({
      ok: false,
      reason: "not_accepting",
    });
    expect(canStartDirectChat(person("a"), person("b", { chatPolicy: "met" }), free)).toEqual({
      ok: false,
      reason: "met_only",
    });
    expect(canStartDirectChat(person("a"), person("b", { chatPolicy: "met" }), { ...free, haveMet: true })).toEqual({
      ok: true,
    });
  });

  it("refuses yourself, suspended and unfinished accounts", () => {
    expect(canStartDirectChat(person("a"), person("a"), free)).toMatchObject({ reason: "self" });
    expect(canStartDirectChat(person("a"), person("b", { status: "suspended" }), free)).toMatchObject({
      reason: "unavailable",
    });
    expect(canStartDirectChat(person("a"), person("b", { onboarded: false }), free)).toMatchObject({
      reason: "unavailable",
    });
  });
});

describe("who may send", () => {
  it("in a direct chat, stops on a block either way", () => {
    const me = { status: "active" };
    const them = { status: "active", firstName: "Ravi" };
    expect(canSendDirect(me, them, { blockedByMe: false, blockedMe: false })).toEqual({ ok: true });
    expect(canSendDirect(me, them, { blockedByMe: true, blockedMe: false })).toMatchObject({ ok: false });
    expect(canSendDirect(me, them, { blockedByMe: false, blockedMe: true })).toMatchObject({
      message: "This member isn't available to chat.",
    });
    expect(canSendDirect(me, { status: "deleted", firstName: "Ravi" }, { blockedByMe: false, blockedMe: false })).toMatchObject({
      ok: false,
    });
  });

  it("in a plan chat, only confirmed members while the plan is on (and a day after)", () => {
    const base = { participationStatus: "accepted", planStatus: "open", endsAt: NOW, now: NOW };
    expect(canSendInPlan(base, 24)).toEqual({ ok: true });
    expect(canSendInPlan({ ...base, participationStatus: "requested" }, 24)).toMatchObject({ ok: false });
    expect(canSendInPlan({ ...base, planStatus: "cancelled" }, 24)).toMatchObject({ ok: false });
    expect(canSendInPlan({ ...base, now: addMinutes(NOW, 23 * 60) }, 24)).toEqual({ ok: true });
    expect(canSendInPlan({ ...base, now: addMinutes(NOW, 25 * 60) }, 24)).toMatchObject({ ok: false });
  });
});

describe("chats in the database", () => {
  beforeAll(async () => {
    await useFreshDatabase();
  });
  afterAll(closeDatabase);

  it("keeps exactly one direct chat per pair, whoever opens it", async () => {
    const a = await makeMember();
    const b = await makeMember();
    const first = await ChatModel.openDirect(a.id, b.id);
    const second = await ChatModel.openDirect(b.id, a.id);
    expect(second.id).toBe(first.id);
    expect(first.directKey).toBe(directKey(b.id, a.id));
    expect((await ChatModel.members(first.id)).map((m) => m.user.id).sort()).toEqual([a.id, b.id].sort());
    expect(await ChatModel.countStartedSince(a.id, addMinutes(new Date(), -60))).toBe(1);
    expect(await ChatModel.countStartedSince(b.id, addMinutes(new Date(), -60))).toBe(0);
  });

  it("tracks unread messages per member and clears them on read", async () => {
    const a = await makeMember();
    const b = await makeMember();
    const chat = await ChatModel.openDirect(a.id, b.id);
    await ChatModel.send({ conversationId: chat.id, senderId: a.id, body: "Chai at 5?" });
    await ChatModel.send({ conversationId: chat.id, senderId: a.id, body: "At the cafeteria" });

    expect((await ChatModel.unreadByConversation(b.id)).get(chat.id)).toBe(2);
    expect(await ChatModel.unreadConversationCount(b.id, new Set())).toBe(1);
    expect(await ChatModel.unreadConversationCount(a.id, new Set())).toBe(0);

    const inbox = await ChatModel.inbox(b.id, new Set());
    expect(inbox).toHaveLength(1);
    expect(inbox[0].other?.id).toBe(a.id);
    expect(inbox[0].last?.body).toBe("At the cafeteria");
    expect(inbox[0].unread).toBe(2);

    await ChatModel.markRead(chat.id, b.id);
    expect(await ChatModel.unreadConversationCount(b.id, new Set())).toBe(0);
  });

  it("hides a direct chat from the inbox and badge once either side blocks", async () => {
    const a = await makeMember();
    const b = await makeMember();
    const chat = await ChatModel.openDirect(a.id, b.id);
    await ChatModel.send({ conversationId: chat.id, senderId: a.id, body: "hello" });
    await BlockModel.block(b.id, a.id);
    const hidden = await BlockModel.relatedIds(b.id);
    expect(await ChatModel.inbox(b.id, hidden)).toHaveLength(0);
    expect(await ChatModel.unreadConversationCount(b.id, hidden)).toBe(0);
    expect(await BlockModel.hasBlocked(b.id, a.id)).toBe(true);
    expect(await BlockModel.hasBlocked(a.id, b.id)).toBe(false);
  });

  it("pages back through history without skipping or repeating messages", async () => {
    const a = await makeMember();
    const b = await makeMember();
    const chat = await ChatModel.openDirect(a.id, b.id);
    const bodies = Array.from({ length: 7 }, (_, i) => `message ${i + 1}`);
    for (const body of bodies) await ChatModel.send({ conversationId: chat.id, senderId: a.id, body });

    const seen: string[] = [];
    let page = await ChatModel.messages(chat.id, { limit: 3 });
    seen.unshift(...page.rows.map((r) => r.message.body));
    while (page.hasEarlier) {
      const first = page.rows[0].message;
      page = await ChatModel.messages(chat.id, { limit: 3, before: { at: first.createdAt, id: first.id } });
      seen.unshift(...page.rows.map((r) => r.message.body));
    }
    expect(seen).toEqual(bodies);

    const latest = (await ChatModel.messages(chat.id, { limit: 1 })).rows[0].message;
    expect(await ChatModel.messagesAfter(chat.id, latest.createdAt)).toHaveLength(0);
  });

  it("keeps a plan's group chat in step with who is confirmed", async () => {
    const host = await makeMember({ gender: "woman" });
    const g1 = await makeMember({ gender: "woman" });
    const g2 = await makeMember({ gender: "man" });
    const plan = await PlanModel.create(
      host,
      {
        activity: "walk",
        spot: "cafeteria",
        note: null,
        startsAt: addMinutes(NOW, 60),
        durationMinutes: 45,
        capacity: 3,
        allowedGenders: ALL,
      },
      NOW,
    );
    // No chat until someone has joined.
    expect(await ChatModel.syncPlan(plan.id)).toBeNull();

    const accept = async (guest: UserRow) => {
      await PlanModel.request(plan.id, guest, null, NOW);
      const bundle = (await PlanModel.bundle(plan.id))!;
      const req = bundle.members.find((m) => m.user.id === guest.id)!;
      await PlanModel.decide(plan.id, host, req.participation.id, "accept", NOW);
      return ChatModel.syncPlan(plan.id);
    };
    const id = (await accept(g1))!;
    expect(id).toBeTruthy();
    const memberIds = async () => (await ChatModel.members(id)).map((m) => m.user.id).sort();
    expect(await memberIds()).toEqual([host.id, g1.id].sort());

    expect(await accept(g2)).toBe(id);
    expect(await memberIds()).toEqual([host.id, g1.id, g2.id].sort());

    await PlanModel.leave(plan.id, g2, "came_up", NOW);
    await ChatModel.syncPlan(plan.id);
    expect(await memberIds()).toEqual([host.id, g1.id].sort());

    // After a cancellation the chat freezes: history stays readable for those who were on it.
    await ChatModel.send({ conversationId: id, senderId: g1.id, body: "See you there" });
    await PlanModel.cancel(plan.id, host, "came_up", NOW);
    expect(await ChatModel.syncPlan(plan.id)).toBe(id);
    expect(await memberIds()).toEqual([host.id, g1.id].sort());
    expect((await ChatModel.messages(id, { limit: 10 })).rows.map((r) => r.message.body)).toEqual(["See you there"]);
  });
});
