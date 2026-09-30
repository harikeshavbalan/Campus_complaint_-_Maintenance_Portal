import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TechnicianApproval } from "@/components/admin-workflow";
import { getComplaintStatusClass, getComplaintStatusLabel } from "@/lib/complaint-status";

const notDoneStatuses = ["open", "verified", "reopened"];
const ongoingStatuses = ["assigned", "in_progress"];
const completedStatuses = ["resolved", "closed"];
const priorityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export default async function Admin() {
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

  const [{ data: complaints }, { data: technicians }] = await Promise.all([
    supabase.from("complaints").select("id,title,category,location,priority,status,created_at"),
    supabase.from("profiles").select("id,full_name,email,account_status").eq("role", "technician").order("full_name"),
  ]);
  const sortedComplaints = [...(complaints || [])].sort((a, b) =>
    (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
    || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const statuses = sortedComplaints.map((complaint) => complaint.status);
  const newComplaints = sortedComplaints.filter((complaint) => notDoneStatuses.includes(complaint.status));
  const ongoingComplaints = sortedComplaints.filter((complaint) => ongoingStatuses.includes(complaint.status));
  const finishedComplaints = sortedComplaints.filter((complaint) => completedStatuses.includes(complaint.status));
  const pendingTechnicians = technicians?.filter((tech) => tech.account_status === "pending") || [];

  return (
    <main className="container">
      <div className="section-title">
        <div>
          <span className="eyebrow">ADMIN</span>
          <h1 style={{ margin: "8px 0" }}>Complaint control</h1>
          <span className="muted">Monitor progress and review new campus issues.</span>
        </div>
        <div className="actions">
          <Link href="/admin/complaints" className="btn btn-primary">Open waiting list</Link>
          <Link href="/admin/ongoing" className="btn btn-secondary">Ongoing complaints</Link>
          <Link href="/admin/history" className="btn btn-secondary">Complaint history</Link>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="muted small">NOT DONE</span>
          <div className="stat">{statuses.filter((status) => notDoneStatuses.includes(status)).length}</div>
        </div>
        <div className="card">
          <span className="muted small">ONGOING</span>
          <div className="stat">{statuses.filter((status) => ongoingStatuses.includes(status)).length}</div>
        </div>
        <div className="card">
          <span className="muted small">COMPLETED</span>
          <div className="stat">{statuses.filter((status) => completedStatuses.includes(status)).length}</div>
        </div>
      </div>

      {[
        { title: "New complaints", complaints: newComplaints, href: "/admin/complaints", linkLabel: "Waiting list" },
        { title: "Ongoing complaints", complaints: ongoingComplaints, href: "/admin/ongoing", linkLabel: "All ongoing" },
        { title: "Finished complaints", complaints: finishedComplaints, href: "/admin/history", linkLabel: "Full history" },
      ].map((section) => (
        <section className="card" style={{ marginTop: 18 }} key={section.title}>
          <div className="section-title">
            <h2>{section.title}</h2>
            {section.href && section.linkLabel && (
              <Link href={section.href} className="btn btn-secondary btn-small">{section.linkLabel}</Link>
            )}
          </div>
          {!section.complaints.length ? (
            <div className="empty">No complaints in this section.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Complaint</th><th>Priority</th><th>Status</th></tr></thead>
                <tbody>
                  {section.complaints.slice(0, 5).map((complaint) => (
                    <tr key={complaint.id}>
                      <td>
                        <Link href={`/complaints/${complaint.id}`}>
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
        </section>
      ))}

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <h2>Technician approvals</h2>
          <span className="muted">Activate maintenance staff</span>
        </div>
        {pendingTechnicians.length ? (
          <div className="list">
            {pendingTechnicians.map((tech) => (
              <TechnicianApproval key={tech.id} id={tech.id} name={tech.full_name || "Technician"} email={tech.email || ""} />
            ))}
          </div>
        ) : (
          <div className="empty">No pending technician requests.</div>
        )}
      </section>
    </main>
  );
}
