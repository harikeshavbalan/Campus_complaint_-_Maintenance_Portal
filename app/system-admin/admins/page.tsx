import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminRequestActions from "./admin-request-actions";

export default async function AdminRequests() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, account_status")
    .eq("id", user.id)
    .single();

  if (!me || me.role !== "system_admin" || me.account_status !== "active") redirect("/dashboard");

  const { data: admins } = await supabase
    .from("profiles")
    .select("id, full_name, email, account_status, created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: false });

  return (
    <main className="container">
      <div className="page-heading page-heading-row">
        <div>
          <span className="eyebrow">SYSTEM ADMINISTRATOR</span>
          <h1>Admin accounts</h1>
          <p>Approve or reject requests for administrative access.</p>
        </div>
        <Link href="/system-admin" className="btn btn-secondary">Back</Link>
      </div>

      <div className="card">
        {!admins?.length ? (
          <div className="empty">No Admin accounts found.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id}>
                    <td>{admin.full_name || "—"}</td>
                    <td>{admin.email || "—"}</td>
                    <td>
                      <span className={`badge ${admin.account_status === "active" ? "badge-green" : admin.account_status === "rejected" ? "badge-red" : "badge-orange"}`}>
                        {admin.account_status}
                      </span>
                    </td>
                    <td>
                      {admin.account_status === "pending" ? (
                        <AdminRequestActions id={admin.id} />
                      ) : <span className="muted small">No action</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
