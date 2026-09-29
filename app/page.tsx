import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-inner">
          <div className="brand-mark">Campus<span>Care</span></div>
          <p className="landing-kicker">CAMPUS COMPLAINT &amp; MAINTENANCE</p>
          <h1>Make campus better.</h1>
          <p className="landing-subtitle">
            Report an issue, follow its progress, and see completed work in one place.
          </p>
          <div className="hero-actions">
            <Link href="/login" className="btn btn-primary">Login</Link>
            <Link href="/signup" className="btn btn-secondary">Create account</Link>
          </div>
        </div>
      </section>

      <section className="landing-space container">
        <div className="empty-panel">
          <span className="empty-number">01</span>
          <div>
            <h2>Finished complaints</h2>
            <p>Completed complaints, photos and resolution details will appear here.</p>
          </div>
        </div>

        <div className="empty-panel">
          <span className="empty-number">02</span>
          <div>
            <h2>Campus updates</h2>
            <p>College events, announcements and other updates can be added here later.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
