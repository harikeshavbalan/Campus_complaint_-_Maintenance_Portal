"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminRequestActions({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function update(status: "active" | "rejected") {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("id", id);
    if (error) window.alert(error.message);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="actions">
      <button className="btn btn-success btn-small" disabled={busy} onClick={() => update("active")}>Approve</button>
      <button className="btn btn-danger btn-small" disabled={busy} onClick={() => update("rejected")}>Reject</button>
    </div>
  );
}
