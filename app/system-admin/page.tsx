import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SystemAdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, role, account_status")
    .eq("id", user.id)
    .single();

  if (!me || me.role !== "system_admin" || me.account_status !== "active") redirect("/dashboard");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("role, account_status");

  const all = profiles ?? [];
  const pendingAdmins = all.filter((p) => p.role === "admin" && p.account_status === "pending").length;
  const activeAdmins = all.filter((p) => p.role === "admin" && p.account_status === "active").length;
  const pendingTechnicians = all.filter((p) => p.role === "technician" && p.account_status === "pending").length;

  return (
    <main className="container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SYSTEM ADMINISTRATOR</span>
          <h1>Administration</h1>
          <p>Control administrative access for CITfix.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card stat-card"><span>Pending Admins</span><strong>{pendingAdmins}</strong></div>
        <div className="card stat-card"><span>Active Admins</span><strong>{activeAdmins}</strong></div>
        <div className="card stat-card"><span>Pending Technicians</span><strong>{pendingTechnicians}</strong></div>
        <div className="card stat-card"><span>Total Users</span><strong>{all.length}</strong></div>
      </div>

      <div className="grid grid-3" style={{ marginTop: 18 }}>
        <Link href="/system-admin/admins" className="card action-card">
          <span className="badge badge-blue">ACCESS</span>
          <h2>Manage Admins</h2>
          <p>Approve or reject Admin account requests.</p>
        </Link>
        <div className="card action-card muted-card">
          <span className="badge">LATER</span>
          <h2>Manage Users</h2>
          <p>User management can be added after the core workflow is complete.</p>
        </div>
        <div className="card action-card muted-card">
          <span className="badge">LATER</span>
          <h2>System Reports</h2>
          <p>Reporting and analytics can be added later.</p>
        </div>
      </div>
    </main>
  );
}
