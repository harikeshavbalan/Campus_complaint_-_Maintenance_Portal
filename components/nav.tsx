"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function Nav(){
  const [user,setUser]=useState<string|null>(null);
  useEffect(()=>{const supabase=createClient();supabase.auth.getUser().then(({data})=>setUser(data.user?.email??null));},[]);
  return <header className="nav"><Link href="/" className="brand">Campus<span>Fix</span></Link><nav className="navlinks"><Link href="/">Home</Link>{user?<><Link href="/dashboard">Dashboard</Link><form action="/auth/signout" method="post"><button>Sign out</button></form></>:<><Link href="/login">Login</Link><Link href="/signup" className="btn btn-primary">Register</Link></>}</nav></header>
}
