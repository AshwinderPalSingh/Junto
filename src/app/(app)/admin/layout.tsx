import { AdminNav } from "@/views/screens/admin/admin-nav";

/** Moderation area chrome. Each page checks the admin role in its controller. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminNav />
      {children}
    </div>
  );
}
