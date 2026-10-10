import "server-only";
import { getActivity } from "@/config/campus";
import { reportCategoryLabel } from "@/config/safety";
import { MetricsModel } from "@/models/metrics.model";
import { ReportModel } from "@/models/report.model";
import { displayName, isOnboarded, UserModel, type User } from "@/models/user.model";
import type { AdminMemberVM, AdminMetricsVM, AdminPersonVM, AdminReportVM } from "@/views/view-models";
import { requireAdmin } from "./guards";
import { avatarUrl } from "./presenters";

const person = (u: User): AdminPersonVM => ({
  id: u.id,
  name: displayName(u),
  email: u.email,
  photoUrl: avatarUrl(u),
  status: u.status,
});

async function memberRows(users: User[]): Promise<AdminMemberVM[]> {
  const counts = await Promise.all(users.map((u) => ReportModel.countAgainst(u.id)));
  return users.map((u, i) => ({
    ...person(u),
    role: u.role,
    gender: u.gender,
    year: u.year ?? "",
    branch: u.branch,
    createdAt: u.createdAt.toISOString(),
    lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
    onboarded: isOnboarded(u),
    reportsAgainst: counts[i],
    suspendedReason: u.suspendedReason,
  }));
}

/** GET handlers for /admin (moderators only). */
export const AdminController = {
  async dashboard(): Promise<{ metrics: AdminMetricsVM; now: string }> {
    await requireAdmin();
    const now = new Date();
    return { metrics: await MetricsModel.dashboard(now), now: now.toISOString() };
  },

  async reports(searchParams: Promise<Record<string, string | string[] | undefined>>) {
    await requireAdmin();
    const { status } = await searchParams;
    const view: "open" | "closed" = status === "closed" ? "closed" : "open";
    const rows = await ReportModel.list(view);
    const counts = await Promise.all(rows.map((r) => ReportModel.countAgainst(r.reported.id)));
    const reports: AdminReportVM[] = rows.map((r, i) => ({
      id: r.report.id,
      category: r.report.category,
      categoryLabel: reportCategoryLabel(r.report.category),
      details: r.report.details,
      status: r.report.status,
      resolution: r.report.resolution,
      createdAt: r.report.createdAt.toISOString(),
      reporter: person(r.reporter),
      reported: { ...person(r.reported), reportsAgainst: counts[i] },
      plan: r.plan
        ? { id: r.plan.id, label: getActivity(r.plan.activity).label, startsAt: r.plan.startsAt.toISOString() }
        : null,
    }));
    return { view, reports, now: new Date().toISOString() };
  },

  async members(searchParams: Promise<Record<string, string | string[] | undefined>>) {
    await requireAdmin();
    const { q } = await searchParams;
    const query = typeof q === "string" ? q.slice(0, 80) : "";
    return { query, members: await memberRows(await UserModel.search(query, 60)), now: new Date().toISOString() };
  },

  async photos() {
    await requireAdmin();
    return { members: await memberRows(await UserModel.recentPhotos(48)) };
  },
};
