import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminComplaintReview } from "@/components/admin-workflow";
import { ComplaintStatusActions } from "@/components/complaint-status-actions";
import { FeedbackForm } from "@/components/complainant-feedback";
import {
  getComplaintProgress,
  getComplaintStatusClass,
  getComplaintStatusLabel,
} from "@/lib/complaint-status";

const progressSteps = ["Not done", "Ongoing", "Completed"] as const;

export default async function ComplaintDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: complaint } = await supabase
    .from("complaints")
    .select("*")
    .eq("id", id)
    .single();
  if (!complaint) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";
  const allowed = complaint.complaint_by === user.id || complaint.complainant_id === user.id || isAdmin || profile?.role === "system_admin";

  const [{ data: task }, { data: attachments }, { data: technicians }, { data: statusHistory }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*,technician:profiles!tasks_technician_id_fkey(full_name,email)")
      .eq("complaint_id", id)
      .maybeSingle(),
    supabase.from("attachments").select("*").eq("complaint_id", id).order("uploaded_at"),
    isAdmin
      ? supabase.from("profiles").select("id,full_name,email").eq("role", "technician").eq("account_status", "active").order("full_name")
      : Promise.resolve({ data: [] }),
    supabase
      .from("complaint_status_history")
      .select("id,old_status,new_status,changed_at,note")
      .eq("complaint_id", id)
      .order("changed_at", { ascending: false }),
  ]);

  if (!allowed && task?.technician_id !== user.id) redirect("/dashboard");

  const images = await Promise.all((attachments || []).map(async (attachment) => {
    const { data } = await supabase.storage
      .from("complaint-attachments")
      .createSignedUrl(attachment.file_path, 3600);
    return { ...attachment, url: data?.signedUrl };
  }));
  const { data: feedback } = await supabase
    .from("feedback")
    .select("id,rating,comments")
    .eq("complaint_id", id)
    .maybeSingle();

  const progress = getComplaintProgress(complaint.status);
  const currentStep = complaint.status === "rejected" ? -1 : progressSteps.indexOf(progress);

  return (
    <main className="container">
      <div className="section-title">
        <div>
          <span className="eyebrow">COMPLAINT</span>
          <h1 style={{ margin: "8px 0" }}>{complaint.title}</h1>
          <span className="muted">{complaint.category} · {complaint.location || "Location not specified"}</span>
        </div>
        <div className="actions">
          <ComplaintStatusActions complaintId={id} status={complaint.status} role={profile?.role || ""} />
          <Link href="/dashboard" className="btn btn-secondary">Back</Link>
        </div>
      </div>

      {isAdmin && !["resolved", "closed"].includes(complaint.status) && (
        <section className="card" style={{ marginBottom: 18 }}>
          <div className="section-title">
            <h2>Review complaint</h2>
            <span className={`badge ${getComplaintStatusClass(complaint.status)}`}>
              {getComplaintStatusLabel(complaint.status)}
            </span>
          </div>
          <AdminComplaintReview
            complaintId={id}
            status={complaint.status}
            technicians={technicians || []}
            assignedId={task?.technician_id || null}
          />
        </section>
      )}

      <div className="two-col">
        <div className="card">
          <h2>Description</h2>
          <p style={{ lineHeight: 1.7 }}>{complaint.description}</p>
          <div className="grid grid-3" style={{ marginTop: 18 }}>
            <div>
              <span className="muted small">PRIORITY</span>
              <div><span className="badge badge-orange">{complaint.priority}</span></div>
            </div>
            <div>
              <span className="muted small">STATUS</span>
              <div>
                <span className={`badge ${getComplaintStatusClass(complaint.status)}`}>
                  {getComplaintStatusLabel(complaint.status)}
                </span>
              </div>
            </div>
            <div>
              <span className="muted small">SUBMITTED</span>
              <div>{complaint.created_at ? new Date(complaint.created_at).toLocaleDateString() : "Date unavailable"}</div>
            </div>
          </div>
          {images.length > 0 && (
            <>
              <h2 style={{ marginTop: 25 }}>Attachments</h2>
              <div className="grid grid-2">
                {images.map((image) => image.url ? (
                  <img
                    key={image.id}
                    src={image.url}
                    alt={image.file_name}
                    style={{ width: "100%", borderRadius: 14, border: "1px solid var(--line)" }}
                  />
                ) : null)}
              </div>
            </>
          )}
        </div>

        <aside className="card">
          <h2>Progress</h2>
          {complaint.status === "rejected" ? (
            <span className="badge badge-red">Rejected</span>
          ) : (
            <div className="timeline">
              {progressSteps.map((step, index) => (
                <div className="step" key={step}>
                  <span className={`dot ${index <= currentStep ? "active" : ""}`}></span>
                  <div style={{ paddingBottom: 18 }}>
                    <strong>{step}</strong>
                    {index === currentStep && <div className="muted small">Current status</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {task && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 15 }}>
              <span className="muted small">TECHNICIAN</span>
              <p><strong>{task.technician?.full_name || "Assigned technician"}</strong></p>
            </div>
          )}
        </aside>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="section-title">
          <h2>Status history</h2>
          <span className="muted">Status changes and technician updates</span>
        </div>
        {!statusHistory?.length ? (
          <div className="empty">No history entries are available yet.</div>
        ) : (
          <div className="list">
            {statusHistory.map((entry) => (
              <article className="list-item" key={entry.id}>
                <div>
                  <strong>
                    {entry.old_status && entry.old_status !== entry.new_status
                      ? `${getComplaintStatusLabel(entry.old_status)} → ${getComplaintStatusLabel(entry.new_status)}`
                      : getComplaintStatusLabel(entry.new_status)}
                  </strong>
                  {entry.note && <p className="muted" style={{ margin: "6px 0 0" }}>{entry.note}</p>}
                </div>
                <time className="muted small" dateTime={entry.changed_at}>
                  {new Date(entry.changed_at).toLocaleString()}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>

      {(complaint.complaint_by === user.id || complaint.complainant_id === user.id) && task?.status === "completed" && ["resolved", "closed"].includes(complaint.status) && !feedback && (
        <section className="card" style={{ marginTop: 18 }}>
          <h2>Rate the resolution</h2>
          <p className="muted">Your feedback helps improve campus maintenance.</p>
          <FeedbackForm complaintId={id} />
        </section>
      )}
      {feedback && (
        <section className="card" style={{ marginTop: 18 }}>
          <h2>Your feedback</h2>
          <p>Rating: <strong>{feedback.rating}/5</strong></p>
          {feedback.comments && <p className="muted">{feedback.comments}</p>}
        </section>
      )}
    </main>
  );
}
