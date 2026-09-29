import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_status")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.account_status !== "active") redirect("/login?message=Your account is waiting for approval.");

  if (profile.role === "system_admin") redirect("/system-admin");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "technician") redirect("/technician");
  redirect("/complainant");
}
