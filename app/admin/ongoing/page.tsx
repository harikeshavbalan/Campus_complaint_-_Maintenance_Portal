import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getComplaintStatusClass,
  getComplaintStatusLabel,
} from "@/lib/complaint-status";

const ongoingStatuses = ["assigned", "in_progress"];
const priorityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export default async function AdminOngoingComplaints() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,account_status")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin" || profile.account_status !== "active") {
    redirect("/dashboard");
  }

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id,title,category,location,priority,status,created_at")
    .in("status", ongoingStatuses);
  const sortedComplaints = [...(complaints || [])].sort((a, b) =>
    (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
    || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <main className="container">
      <div className="section-title">
        <div>
          <span className="eyebrow">ADMIN</span>
          <h1 style={{ margin: "8px 0" }}>Ongoing complaints</h1>
          <span className="muted">Complaints assigned to a technician or currently in progress.</span>
        </div>
        <div className="actions">
          <Link href="/admin/complaints" className="btn btn-secondary">Waiting list</Link>
          <Link href="/admin/history" className="btn btn-secondary">Complaint history</Link>
          <Link href="/admin" className="btn btn-primary">Dashboard</Link>
        </div>
      </div>

      <section className="card">
        {!sortedComplaints.length ? (
          <div className="empty">No complaints are currently ongoing.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {sortedComplaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td>
                      <Link href={`/complaints/${complaint.id}`} className="complaint-title-link">
                        <strong>{complaint.title}</strong>
                      </Link>
                      <div className="muted small">
                        {complaint.category} · {complaint.location || "Location not specified"}
                      </div>
                    </td>
                    <td>{complaint.priority}</td>
                    <td>
                      <span className={`badge ${getComplaintStatusClass(complaint.status)}`}>
                        {getComplaintStatusLabel(complaint.status)}
                      </span>
                    </td>
                    <td>{complaint.created_at ? new Date(complaint.created_at).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}