import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RULES } from "@/config/app";
import { LoginCodeModel } from "@/models/auth.model";
import { hasPhoto, isOnboarded, UserModel } from "@/models/user.model";
import { closeDatabase, makeMember, useFreshDatabase } from "./helpers/db";

beforeAll(async () => {
  await useFreshDatabase();
});
afterAll(closeDatabase);

afterEach(() => {
  vi.useRealTimers();
});

/** Moves the clock forward (Date only, so the database's own timers keep running). */
function advance(ms: number) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + ms);
}

describe("sign-in codes", () => {
  it("issues a numeric code that works exactly once", async () => {
    const email = "once@thapar.edu";
    const code = await LoginCodeModel.issue(email);
    expect(code).toMatch(new RegExp(`^\\d{${RULES.otp.length}}$`));
    await expect(LoginCodeModel.verify(email, code)).resolves.toEqual({ passwordHash: null, flowHash: null });
    await expect(LoginCodeModel.verify(email, code)).rejects.toMatchObject({ code: "expired" });
  });

  it("makes people wait before asking for another code", async () => {
    const email = "cooldown@thapar.edu";
    await LoginCodeModel.issue(email);
    await expect(LoginCodeModel.issue(email)).rejects.toMatchObject({ code: "too_soon" });
    advance((RULES.otp.resendAfterSeconds + 1) * 1000);
    await expect(LoginCodeModel.issue(email)).resolves.toMatch(/^\d+$/);
  });

  it("only the newest code is valid after a resend", async () => {
    const email = "resend@thapar.edu";
    const first = await LoginCodeModel.issue(email);
    advance((RULES.otp.resendAfterSeconds + 1) * 1000);
    const second = await LoginCodeModel.issue(email);
    if (first !== second) {
      await expect(LoginCodeModel.verify(email, first)).rejects.toMatchObject({ code: "mismatch" });
    }
    await expect(LoginCodeModel.verify(email, second)).resolves.toEqual({ passwordHash: null, flowHash: null });
  });

  it("counts wrong tries down and then locks the code", async () => {
    const email = "wrong@thapar.edu";
    const code = await LoginCodeModel.issue(email);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 1; i < RULES.otp.maxAttempts; i += 1) {
      await expect(LoginCodeModel.verify(email, wrong)).rejects.toMatchObject({ code: "mismatch" });
    }
    await expect(LoginCodeModel.verify(email, wrong)).rejects.toThrow(/Too many wrong tries/);
    // Even the right code no longer works once locked.
    await expect(LoginCodeModel.verify(email, code)).rejects.toMatchObject({ code: "locked" });
  });

  it("expires codes after their time to live", async () => {
    const email = "late@thapar.edu";
    const code = await LoginCodeModel.issue(email);
    advance((RULES.otp.ttlMinutes * 60 + 1) * 1000);
    await expect(LoginCodeModel.verify(email, code)).rejects.toMatchObject({ code: "expired" });
  });

  it("discards a code that never reached the inbox, so a retry isn't blocked", async () => {
    const email = "bounced@thapar.edu";
    const code = await LoginCodeModel.issue(email);
    await LoginCodeModel.discardUnused(email);
    await expect(LoginCodeModel.verify(email, code)).rejects.toMatchObject({ code: "expired" });
    await expect(LoginCodeModel.issue(email)).resolves.toMatch(/^\d+$/);
  });
});

describe("the one profile photo", () => {
  it("is stored in the database and required for onboarding", async () => {
    const member = await makeMember();
    expect(hasPhoto(member)).toBe(true);
    expect(isOnboarded(member)).toBe(true);
    const photo = await UserModel.getPhoto(member.id);
    expect(photo?.contentType).toBe("image/webp");
    expect(photo?.data.toString()).toBe("webp-bytes");
  });

  it("is replaced, never duplicated, on a new upload", async () => {
    const member = await makeMember();
    await UserModel.setPhoto(member.id, Buffer.from("new-face"));
    expect((await UserModel.getPhoto(member.id))?.data.toString()).toBe("new-face");
  });

  it("is deleted when a moderator rejects it, which sends the member back to setup", async () => {
    const member = await makeMember();
    await UserModel.rejectPhoto(member.id);
    expect(await UserModel.getPhoto(member.id)).toBeNull();
    const after = (await UserModel.findById(member.id))!;
    expect(hasPhoto(after)).toBe(false);
    expect(isOnboarded(after)).toBe(false);
    expect(after.photoRejectedAt).not.toBeNull();
  });

  it("is wiped with the account", async () => {
    const member = await makeMember();
    await UserModel.anonymize(member.id);
    expect(await UserModel.getPhoto(member.id)).toBeNull();
  });
});
