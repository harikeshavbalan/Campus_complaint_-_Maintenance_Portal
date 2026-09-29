import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getComplaintStatusClass,
  getComplaintStatusLabel,
} from "@/lib/complaint-status";

export default async function Complainant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,role,account_status")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "complainant") redirect("/dashboard");
  if (profile.account_status !== "active") redirect("/login?message=Your account is waiting for approval.");

  const { data: complaints } = await supabase
    .from("complaints")
    .select("id,title,category,status,created_at")
    .or(`complaint_by.eq.${user.id},complainant_id.eq.${user.id}`)
    .order("created_at", { ascending: false });
  const myComplaints = complaints || [];

  return (
    <main className="container">
      <div className="section-title">
        <div>
          <span className="eyebrow">COMPLAINANT</span>
          <h1 style={{ margin: "8px 0" }}>Hello, {profile.full_name || "there"}</h1>
        </div>
        <Link href="/complaints/new" className="btn btn-primary">New complaint</Link>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="card">
          <span className="muted small">TOTAL</span>
          <div className="stat">{myComplaints.length}</div>
          <span className="muted">Your complaints</span>
        </div>
        <div className="card">
          <span className="muted small">ACTIVE</span>
          <div className="stat">{myComplaints.filter((complaint) => !["resolved", "closed", "rejected"].includes(complaint.status)).length}</div>
          <span className="muted">Still being handled</span>
        </div>
        <div className="card">
          <span className="muted small">COMPLETED</span>
          <div className="stat">{myComplaints.filter((complaint) => ["resolved", "closed"].includes(complaint.status)).length}</div>
          <span className="muted">Finished work</span>
        </div>
      </div>

      <section className="card">
        <div className="section-title">
          <h2>My complaints</h2>
          <span className="muted">Latest first</span>
        </div>
        {!myComplaints.length ? (
          <div className="empty">No complaints yet. Report your first campus issue.</div>
        ) : (
          <div className="list">
            {myComplaints.map((complaint) => (
              <Link className="list-item" href={`/complaints/${complaint.id}`} key={complaint.id}>
                <div>
                  <strong>{complaint.title}</strong>
                  <div className="muted small">
                    {complaint.category} · {complaint.created_at ? new Date(complaint.created_at).toLocaleDateString() : "Date unavailable"}
                  </div>
                </div>
                <span className={`badge ${getComplaintStatusClass(complaint.status)}`}>
                  {getComplaintStatusLabel(complaint.status)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
