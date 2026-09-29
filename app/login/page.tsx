"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Login succeeded, but no user session was returned. Please try again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,account_status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      await supabase.auth.signOut();
      setError(`Your account profile could not be loaded: ${profileError.message}`);
      setLoading(false);
      return;
    }
    if (!profile || profile.account_status !== "active") {
      await supabase.auth.signOut();
      setError(profile?.account_status === "pending" ? "Your account is waiting for approval." : profile?.account_status === "rejected" ? "This account was rejected." : "No active profile was found for this account.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="login-page">
      <div className="auth-card">
        <span className="eyebrow">CITFIX</span>
        <h1>Welcome back</h1>
        <p>Sign in to continue to your campus portal.</p>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field"><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></div>
          <div className="field"><label className="label" htmlFor="password">Password</label><input id="password" className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></div>
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
        <p className="small" style={{ marginTop: 18 }}>New user? <Link href="/signup" style={{ color: "var(--primary)", fontWeight: 700 }}>Create an account</Link></p>
      </div>
    </main>
  );
}
