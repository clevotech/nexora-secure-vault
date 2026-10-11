import React,{useEffect,useState,type ReactNode} from "react";
import {hasEmployeeSession,signInWithEmployeeId} from "./auth";

export default function EmployeeLoginGate({children}:{children:ReactNode}){
 const [ready,setReady]=useState(false),[signedIn,setSignedIn]=useState(false);
 const [userId,setUserId]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 useEffect(()=>{let alive=true;void hasEmployeeSession().then(value=>{if(alive){setSignedIn(value);setReady(true)}}).catch(()=>{if(alive)setReady(true)});return()=>{alive=false}},[]);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setMessage("");try{await signInWithEmployeeId(userId,password);setSignedIn(true);window.location.reload()}catch(error){setMessage(error instanceof Error?error.message:"Could not sign in. Check your ID and password, then try again.")}finally{setBusy(false)}};
 if(!ready)return <section className="card ai-panel"><p className="hint">Checking your Nexora account…</p></section>;
 if(signedIn)return <>{children}</>;
 return <section className="card ai-panel" style={{maxWidth:520,margin:"24px auto"}}>
  <span className="kicker">NEXORA EMPLOYEE ACCESS</span>
  <h2>Sign in to Leave Tracker</h2>
  <p className="hint">Use the short Nexora User ID provided by your Admin Officer and the password you set when activating your account.</p>
  <form className="project-form" onSubmit={submit}>
   <label>Nexora User ID<input className="tool-input" autoComplete="username" value={userId} onChange={event=>setUserId(event.target.value.toUpperCase())} placeholder="NXU-7A3F91C2" maxLength={16} required/></label>
   <label>Password or PIN<input className="tool-input" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Enter your password or PIN" maxLength={1024} required/></label>
   <button className="primary wide" type="submit" disabled={busy||!userId.trim()||!password}>{busy?"Signing in…":"Sign in securely"}</button>
  </form>
  {message&&<p className="hint" role="alert">{message}</p>}
  <p className="hint">Forgot your password? Use the password reset link from your account email or contact your Admin Officer. Your User ID alone cannot open your records.</p>
 </section>;
}
