"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type Tech={id:string;full_name:string|null;email:string|null};
export function AdminComplaintReview({complaintId,status,technicians,assignedId}:{complaintId:string;status:string;technicians:Tech[];assignedId:string|null}) {
	const [busy,setBusy]=useState(false);
	const [tech,setTech]=useState(assignedId||'');
	const [error,setError]=useState('');
	const router=useRouter();

	async function updateStatus(nextStatus:string) {
		setBusy(true);
		setError('');
		const {error: updateError}=await createClient().from('complaints').update({status:nextStatus}).eq('id',complaintId);
		if(updateError) setError(updateError.message);
		else router.refresh();
		setBusy(false);
	}

	async function assignTechnician() {
		if(!tech) return;
		setBusy(true);
		setError('');
		const supabase=createClient();
		const {error: taskError}=await supabase.from('tasks').upsert(
			{complaint_id:complaintId,technician_id:tech,status:'assigned'},
			{onConflict:'complaint_id'}
		);
		if(taskError) {
			setError(taskError.message);
			setBusy(false);
			return;
		}
		const {error: statusError}=await supabase.from('complaints').update({status:'assigned'}).eq('id',complaintId);
		if(statusError) setError(statusError.message);
		else router.refresh();
		setBusy(false);
	}

	return <div>
		<div className="actions">
			{['open','verified','reopened','rejected'].includes(status)&&<>
				<button className="btn btn-success btn-small" disabled={busy} onClick={()=>updateStatus('verified')}>Accept</button>
				<button className="btn btn-danger btn-small" disabled={busy} onClick={()=>updateStatus('rejected')}>Reject</button>
				<button className="btn btn-secondary btn-small" disabled={busy} onClick={()=>updateStatus('open')}>Draft</button>
			</>}
			{status==='verified'&&<>
				<select className="select" style={{width:150,padding:'7px 9px'}} value={tech} onChange={e=>setTech(e.target.value)}>
					<option value="">Select technician</option>
					{technicians.map(t=><option key={t.id} value={t.id}>{t.full_name||t.email}</option>)}
				</select>
				<button className="btn btn-primary btn-small" disabled={busy||!tech} onClick={assignTechnician}>Assign</button>
			</>}
		</div>
		{error&&<div className="alert error" role="alert" style={{marginTop:10}}>{error}</div>}
	</div>
}
export function TechnicianApproval({id,name,email}:{id:string;name:string;email:string}){const [busy,setBusy]=useState(false);const r=useRouter();async function act(status:'active'|'rejected'){setBusy(true);await createClient().from('profiles').update({account_status:status}).eq('id',id);setBusy(false);r.refresh()}return <div className="list-item"><div><strong>{name}</strong><div className="muted small">{email}</div></div><div className="actions"><button className="btn btn-success btn-small" disabled={busy} onClick={()=>act('active')}>Approve</button><button className="btn btn-danger btn-small" disabled={busy} onClick={()=>act('rejected')}>Reject</button></div></div>}
