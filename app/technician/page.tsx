import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TechnicianTaskActions } from "@/components/technician-actions";
import { getComplaintStatusClass, getComplaintStatusLabel } from "@/lib/complaint-status";

export default async function Technician() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,email,role,account_status")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "technician" || profile.account_status !== "active") {
    redirect("/dashboard");
  }

  const { data, error: tasksError } = await supabase
    .from("tasks")
    .select("*,complaint:complaints(*)")
    .eq("technician_id", user.id)
    .order("assigned_date", { ascending: false });
  const tasks = data || [];

  return (
    <main className="container">
      <div className="section-title">
        <div>
          <span className="eyebrow">TECHNICIAN</span>
          <h1 style={{ margin: "8px 0" }}>My work</h1>
          <span className="muted">Update assigned complaints as work progresses.</span>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <span className="muted small">ASSIGNED</span>
          <div className="stat">{tasks.filter((task) => task.status === "assigned").length}</div>
        </div>
        <div className="card">
          <span className="muted small">ONGOING</span>
          <div className="stat">{tasks.filter((task) => task.status === "in_progress").length}</div>
        </div>
        <div className="card">
          <span className="muted small">COMPLETED</span>
          <div className="stat">{tasks.filter((task) => task.status === "completed").length}</div>
        </div>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-title"><h2>Assigned complaints</h2></div>
        {tasksError ? (
          <div className="alert error" role="alert">Could not load assigned work: {tasksError.message}</div>
        ) : !tasks.length ? (
          <div className="empty">
            No work is assigned to {profile.full_name || "this technician account"}{profile.email ? ` (${profile.email})` : ""} yet. Ask an admin to assign a complaint to this account.
          </div>
        ) : (
          <div className="list">
            {tasks.map((task) => (
              <article className="list-item" key={task.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/complaints/${task.complaint_id}`}>
                    <strong>{task.complaint?.title || "Complaint"}</strong>
                  </Link>
                  <div className="muted small">
                    {task.complaint?.category} · {task.complaint?.location || "Location not specified"}
                  </div>
                  <p className="muted">{task.complaint?.description}</p>
                  <span className={`badge ${getComplaintStatusClass(task.complaint?.status || "")}`}>
                    {getComplaintStatusLabel(task.complaint?.status || "")}
                  </span>
                </div>
                <TechnicianTaskActions
                  taskId={task.id}
                  complaintId={task.complaint_id}
                  taskStatus={task.status}
                  complaintStatus={task.complaint?.status || "assigned"}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
