"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function TechnicianTaskActions({
  taskId,
  complaintId,
  taskStatus,
  complaintStatus,
}: {
  taskId: string;
  complaintId: string;
  taskStatus: string;
  complaintStatus: string;
}) {
  const [busy, setBusy] = useState(false);
  const [updateText, setUpdateText] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function updateStatus(next: "in_progress" | "completed") {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: taskError } = await supabase
      .from("tasks")
      .update({ status: next, completed_date: next === "completed" ? new Date().toISOString() : null })
      .eq("id", taskId);
    if (taskError) {
      setError(taskError.message);
      setBusy(false);
      return;
    }

    const { error: complaintError } = await supabase
      .from("complaints")
      .update({ status: next === "completed" ? "resolved" : "in_progress" })
      .eq("id", complaintId);
    if (complaintError) setError(complaintError.message);
    else router.refresh();
    setBusy(false);
  }

  async function saveUpdate() {
    const note = updateText.trim();
    if (!note) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Please sign in again to save this update.");
      setBusy(false);
      return;
    }

    const { error: historyError } = await supabase.from("complaint_status_history").insert({
      complaint_id: complaintId,
      old_status: complaintStatus,
      new_status: complaintStatus,
      changed_by: user.id,
      note,
    });
    if (historyError) setError(historyError.message);
    else {
      setUpdateText("");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div style={{ minWidth: 240, maxWidth: 340, width: "100%" }}>
      <div className="actions">
        {taskStatus === "assigned" && (
          <button className="btn btn-primary btn-small" disabled={busy} onClick={() => updateStatus("in_progress")}>
            Start work
          </button>
        )}
        {taskStatus === "in_progress" && (
          <button className="btn btn-success btn-small" disabled={busy} onClick={() => updateStatus("completed")}>
            Mark completed
          </button>
        )}
        {taskStatus === "completed" && <span className="badge badge-green">Completed</span>}
      </div>
      {taskStatus !== "completed" && (
        <div className="field" style={{ marginTop: 12 }}>
          <label className="label" htmlFor={`progress-${taskId}`}>Progress update</label>
          <textarea
            id={`progress-${taskId}`}
            className="textarea"
            style={{ minHeight: 72 }}
            value={updateText}
            onChange={(event) => setUpdateText(event.target.value)}
            placeholder="Record work completed or next steps"
          />
          <button className="btn btn-secondary btn-small" disabled={busy || !updateText.trim()} onClick={saveUpdate}>
            Save update
          </button>
        </div>
      )}
      {error && <div className="alert error" role="alert" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
