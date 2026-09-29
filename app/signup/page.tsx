"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("complainant");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMsg("");
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const supabase = createClient();
    const { error: signupError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: name.trim(), phone: phone.trim(), student_id: studentId.trim(), department: department.trim(), requested_role: role } },
    });
    if (signupError) {
      setError(signupError.message);
      return;
    }
    setMsg(role === "complainant" ? "Account created. You can sign in." : `${role === "admin" ? "Admin" : "Technician"} request created. The appropriate administrator will validate the account.`);
  }

  return (
    <main className="login-page">
      <div className="auth-card">
        <span className="eyebrow">REGISTER</span>
        <h1>Create account</h1>
        <p>Enter your details to create a campus portal account.</p>
        {error && <div className="alert error">{error}</div>}
        {msg && <div className="alert success">{msg}</div>}
        <form onSubmit={submit}>
          <div className="field"><label className="label" htmlFor="name">Full name</label><input id="name" className="input" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" /></div>
          <div className="field"><label className="label" htmlFor="email">Email address</label><input id="email" className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></div>
          <div className="field"><label className="label" htmlFor="phone">Phone number</label><input id="phone" className="input" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required autoComplete="tel" /></div>
          <div className="field"><label className="label" htmlFor="student-id">Student / Staff ID</label><input id="student-id" className="input" value={studentId} onChange={(event) => setStudentId(event.target.value)} required /></div>
          <div className="field"><label className="label" htmlFor="department">Department</label><input id="department" className="input" value={department} onChange={(event) => setDepartment(event.target.value)} required /></div>
          <div className="field"><label className="label" htmlFor="password">Password</label><input id="password" className="input" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" /></div>
          <div className="field"><label className="label" htmlFor="confirm-password">Confirm password</label><input id="confirm-password" className="input" type="password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required autoComplete="new-password" /></div>
          <div className="field"><label className="label" htmlFor="role">Account type</label><select id="role" className="select" value={role} onChange={(event) => setRole(event.target.value)}><option value="complainant">Student / Staff - Complainant</option><option value="technician">Technician - requires approval</option><option value="admin">Admin - requires approval</option></select></div>
          <button className="btn btn-primary" style={{ width: "100%" }}>Register</button>
        </form>
        <p className="small" style={{ marginTop: 18 }}>Already registered? <Link href="/login" style={{ color: "var(--primary)", fontWeight: 700 }}>Sign in</Link></p>
      </div>
    </main>
  );
}
