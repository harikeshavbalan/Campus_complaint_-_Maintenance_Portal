const completedStatuses = new Set(["resolved", "closed"]);
const ongoingStatuses = new Set(["assigned", "in_progress"]);

export type ComplaintProgress = "Not done" | "Ongoing" | "Completed";

export function getComplaintProgress(status: string): ComplaintProgress {
  if (completedStatuses.has(status)) return "Completed";
  if (ongoingStatuses.has(status)) return "Ongoing";
  return "Not done";
}

export function getComplaintStatusLabel(status: string): string {
  return status === "rejected" ? "Rejected" : getComplaintProgress(status);
}

export function getComplaintStatusClass(status: string): string {
  if (status === "rejected") return "badge-red";
  if (completedStatuses.has(status)) return "badge-green";
  if (ongoingStatuses.has(status)) return "badge-orange";
  return "badge-blue";
}
