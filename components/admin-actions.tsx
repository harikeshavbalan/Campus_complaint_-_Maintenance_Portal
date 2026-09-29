"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export function AdminRequestActions({id}:{id:string}){const [busy,setBusy]=useState(false);const r=useRouter();async function act(status:'active'|'rejected'){setBusy(true);const s=createClient();await s.from('profiles').update({account_status:status}).eq('id',id);setBusy(false);r.refresh()}return <div className="actions"><button className="btn btn-success btn-small" disabled={busy} onClick={()=>act('active')}>Approve</button><button className="btn btn-danger btn-small" disabled={busy} onClick={()=>act('rejected')}>Reject</button></div>}
export function ProfileActions({id,role,status}:{id:string;role:string;status:string}){return null}
