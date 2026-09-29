"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export function ComplaintStatusActions({complaintId,status,role}:{complaintId:string;status:string;role:string}){const [busy,setBusy]=useState(false);const r=useRouter();async function setStatus(next:string){setBusy(true);const s=createClient();await s.from('complaints').update({status:next}).eq('id',complaintId);setBusy(false);r.refresh()}return <div className="actions">{role==='admin'&&status==='resolved'&&<button className="btn btn-success btn-small" disabled={busy} onClick={()=>setStatus('closed')}>Close complaint</button>}{role==='complainant'&&status==='closed'&&<button className="btn btn-secondary btn-small" disabled={busy} onClick={()=>setStatus('reopened')}>Reopen</button>}</div>}
