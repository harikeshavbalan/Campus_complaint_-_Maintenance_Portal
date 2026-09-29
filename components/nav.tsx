"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function Nav(){
  const [user,setUser]=useState<string|null>(null);
  const [role,setRole]=useState<string|null>(null);
  const pathname=usePathname();
  useEffect(()=>{const supabase=createClient();let mounted=true;async function loadUser(currentUser:{id:string;email?:string}|null){if(!mounted)return;setUser(currentUser?.email??null);setRole(null);if(!currentUser)return;const {data:profile}=await supabase.from('profiles').select('role,account_status').eq('id',currentUser.id).maybeSingle();if(mounted)setRole(profile?.account_status==='active'?profile.role:null);}supabase.auth.getUser().then(({data})=>loadUser(data.user));const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{void loadUser(session?.user??null);});return()=>{mounted=false;subscription.unsubscribe();};},[]);
  return <header className="nav"><Link href="/" className="brand">Campus<span>Fix</span></Link>{pathname!=="/"&&<nav className="navlinks"><Link href="/">Home</Link>{user?<><Link href="/dashboard">Dashboard</Link>{role==='admin'&&<Link href="/admin">Admin panel</Link>}{role==='system_admin'&&<Link href="/system-admin">Administration</Link>}<form action="/auth/signout" method="post"><button>Sign out</button></form></>:<><Link href="/login">Login</Link><Link href="/signup" className="btn btn-primary">Register</Link></>}</nav>}</header>
}
