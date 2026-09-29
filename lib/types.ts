export type Role = "complainant" | "admin" | "technician" | "system_admin";
export type AccountStatus = "pending" | "active" | "rejected";
export type ComplaintStatus = "open" | "verified" | "assigned" | "in_progress" | "resolved" | "closed" | "reopened" | "rejected";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  role: Role;
  account_status: AccountStatus;
  department_id?: string | null;
};

export type Complaint = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  status: ComplaintStatus;
  location: string | null;
  complaint_by: string;
  created_at: string;
  updated_at: string;
};
