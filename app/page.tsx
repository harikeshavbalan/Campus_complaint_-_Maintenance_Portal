import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type CompletedComplaint = {
  id: string;
  title: string;
  category: string;
  location: string | null;
  priority: string;
  completed_at: string;
};

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_completed_complaints");
  const completedComplaints = (data || []) as CompletedComplaint[];

  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-inner">
          <div className="brand-mark">Campus<span>Care</span></div>
          <h1>Campus complaint portal</h1>
          <div className="hero-actions">
            <Link href="/login" className="btn btn-primary">Login</Link>
            <Link href="/signup" className="btn btn-secondary">Create account</Link>
          </div>
        </div>
      </section>

      <section className="container">
        <div className="section-title">
          <h2>Finished complaints</h2>
          <span className="muted">Recently completed campus work</span>
        </div>
        {completedComplaints.length === 0 ? (
          <div className="empty">Completed complaints will appear here.</div>
        ) : (
          <div className="list">
            {completedComplaints.map((complaint) => (
              <article className="list-item" key={complaint.id}>
                <div>
                  <strong>{complaint.title}</strong>
                  <div className="muted small">
                    {complaint.category} · {complaint.location || "Location not specified"}
                  </div>
                </div>
                <span className="badge badge-green">Completed</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
