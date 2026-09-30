import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getComplaintStatusClass,
  getComplaintStatusLabel,
} from "@/lib/complaint-status";

const waitingStatuses = ["open", "verified", "reopened"];
const priorityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export default async function AdminComplaints() {
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
    .in("status", waitingStatuses);
  const sortedComplaints = [...(complaints || [])].sort((a, b) =>
    (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
    || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <main className="container">
      <div className="section-title">
        <div>
          <span className="eyebrow">ADMIN</span>
          <h1 style={{ margin: "8px 0" }}>Waiting list</h1>
          <span className="muted">Open a complaint to review its details and decide what happens next.</span>
        </div>
        <div className="actions">
          <Link href="/admin/ongoing" className="btn btn-secondary">Ongoing complaints</Link>
          <Link href="/admin/history" className="btn btn-secondary">Complaint history</Link>
          <Link href="/admin" className="btn btn-secondary">Dashboard</Link>
        </div>
      </div>

      <div className="card">
        {!complaints?.length ? (
          <div className="empty">No complaints are waiting for review.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>Priority</th>
                  <th>Progress</th>
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
