import React,{useEffect,useMemo,useState} from "react";
import {ensureAnonymousSession,supabase} from "./auth";

type Props={onClose:()=>void};
type Mode="signin"|"signup"|"reset";

export default function AccountAccess({onClose}:Props){
 const [mode,setMode]=useState<Mode>("signup");
 const [email,setEmail]=useState("");
 const [fullName,setFullName]=useState("");
 const [password,setPassword]=useState("");
 const [confirmPassword,setConfirmPassword]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const [accepted,setAccepted]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [user,setUser]=useState<any>(null);
 const [anonymous,setAnonymous]=useState(false);
 const strength=useMemo(()=>[
   password.length>=12,
   /[a-z]/.test(password),
   /[A-Z]/.test(password),
   /\d/.test(password),
   /[^A-Za-z0-9]/.test(password)
 ],[password]);
 const score=strength.filter(Boolean).length;
 const refreshSession=async()=>{
   if(!supabase){setUser(null);setAnonymous(false);return;}
   const {data}=await supabase.auth.getSession();
   setUser(data.session?.user||null);
   setAnonymous(Boolean(data.session?.user?.is_anonymous));
 };
 useEffect(()=>{
   void refreshSession();
   if(!supabase)return;
   const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
     setUser(session?.user||null);
     setAnonymous(Boolean(session?.user?.is_anonymous));
   });
   return()=>subscription.unsubscribe();
 },[]);
 const resetForm=(next:Mode)=>{setMode(next);setMessage("");setError("");setPassword("");setConfirmPassword("");setShowPassword(false);};
 const submit=async(e:React.FormEvent)=>{
   e.preventDefault();setMessage("");setError("");
   if(!supabase){setError("Secure sign-up is not configured yet. Ask the Nexora administrator to configure Supabase authentication.");return;}
   const normalized=email.trim().toLowerCase();
   if(!normalized||!/^\S+@\S+\.\S+$/.test(normalized)){setError("Enter a valid email address.");return;}
   if(mode==="signup"){
     if(!fullName.trim()){setError("Enter your full name.");return;}
     if(score<5){setError("Use at least 12 characters with uppercase and lowercase letters, a number and a symbol.");return;}
     if(password!==confirmPassword){setError("The passwords do not match.");return;}
     if(!accepted){setError("Accept the Terms and Privacy Notice to create an account.");return;}
   }
   if(mode==="signin"&&!password){setError("Enter your password.");return;}
   setBusy(true);
   try{
     if(mode==="reset"){
       const redirectTo=window.location.origin+window.location.pathname;
       const {error}=await supabase.auth.resetPasswordForEmail(normalized,{redirectTo});
       if(error)throw error;
       setMessage("If an account exists for that email, a password-reset link will be sent. Check your inbox and spam folder.");
       return;
     }
     if(mode==="signin"){
       const {error}=await supabase.auth.signInWithPassword({email:normalized,password});
       if(error)throw error;
       setMessage("You’re securely signed in.");
       await refreshSession();
       window.setTimeout(onClose,500);
       return;
     }
     const {data:{session}}=await supabase.auth.getSession();
     if(session?.user?.is_anonymous){
       const {data,error}=await supabase.auth.updateUser({email:normalized,password,data:{full_name:fullName.trim(),account_created_at:new Date().toISOString()}});
       if(error)throw error;
       if(data.user){
         setMessage("Account details submitted. Check your email for a verification link if email confirmation is enabled. Your existing browser session may remain active until verification completes.");
         await refreshSession();
       }
     }else{
       const {data,error}=await supabase.auth.signUp({email:normalized,password,options:{data:{full_name:fullName.trim()},emailRedirectTo:window.location.origin+window.location.pathname}});
       if(error)throw error;
       if(data.session){
         setMessage("Your account is ready and you’re signed in.");
         await refreshSession();
         window.setTimeout(onClose,700);
       }else{
         setMessage("Account registration started. Check your email for the verification link, then sign in. If it doesn’t arrive, check spam.");
       }
     }
   }catch(e){
     const raw=e instanceof Error?e.message:"Authentication failed. Please try again.";
     setError(raw.toLowerCase().includes("invalid login credentials")?"Email or password is incorrect.":raw.toLowerCase().includes("user already registered")?"An account already exists for this email. Switch to Sign in or reset your password.":raw);
   }finally{setBusy(false);}
 };
 const signOut=async()=>{
   if(!supabase)return;
   setBusy(true);setError("");setMessage("");
   try{
     const {error}=await supabase.auth.signOut();
     if(error)throw error;
     await ensureAnonymousSession().catch(()=>null);
     await refreshSession();
     setMessage("You’ve signed out. This browser is now using guest access.");
     resetForm("signin");
   }catch(e){setError(e instanceof Error?e.message:"Could not sign out.");}
   finally{setBusy(false);}
 };
 const accountEmail=user?.email||"";
 return <div className="account-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-heading">
   <button className="account-close" type="button" aria-label="Close account dialog" onClick={onClose}>×</button>
   <div className="account-brand"><span className="account-brand-mark">N</span><span><b>Nexora AI</b><small>Secure account access</small></span></div>
   <span className="kicker">YOUR ACCOUNT · PROTECTED BY SUPABASE AUTH</span>
   <h2 id="account-heading">{user&&!anonymous?"Your secure account":mode==="signup"?"Create your account":mode==="signin"?"Welcome back":"Reset your password"}</h2>
   <p className="hint">{user&&!anonymous?"Your account is signed in on this device.": "Use your email to secure your workspace and keep account access recoverable."}</p>
   {user&&!anonymous?<div className="account-session">
    <div className="account-status-dot"/><div><strong>{user.user_metadata?.full_name||accountEmail||"Nexora member"}</strong><p>{accountEmail}</p><small>{user.email_confirmed_at?"Email verified":"Confirm your email to strengthen account recovery"}</small></div>
    <button className="secondary" type="button" disabled={busy} onClick={()=>void signOut()}>{busy?"Signing out…":"Sign out"}</button>
   </div>:<><div className="account-mode-tabs" role="tablist" aria-label="Account actions">
     <button type="button" role="tab" aria-selected={mode==="signup"} className={mode==="signup"?"active":""} onClick={()=>resetForm("signup")}>Sign up</button>
     <button type="button" role="tab" aria-selected={mode==="signin"} className={mode==="signin"?"active":""} onClick={()=>resetForm("signin")}>Sign in</button>
     <button type="button" role="tab" aria-selected={mode==="reset"} className={mode==="reset"?"active":""} onClick={()=>resetForm("reset")}>Reset</button>
    </div>
    <form className="account-form" onSubmit={submit} noValidate>
     {mode==="signup"&&<label>Full name<input autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} maxLength={100} placeholder="Your name" required/></label>}
     <label>Email address<input type="email" autoComplete="email" inputMode="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} placeholder="you@example.com" required/></label>
     {mode!=="reset"&&<label>Password <span className="account-label-note">{mode==="signup"?"12+ characters recommended":"Your account password"}</span><div className="account-password-row"><input type={showPassword?"text":"password"} autoComplete={mode==="signup"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} minLength={mode==="signup"?12:1} placeholder={mode==="signup"?"Create a strong password":"Enter your password"} required/><button type="button" className="account-show-password" onClick={()=>setShowPassword(v=>!v)}>{showPassword?"Hide":"Show"}</button></div></label>}
     {mode==="signup"&&password&&<div className="password-strength" aria-live="polite"><div className="password-strength-track"><span data-score={score} style={{width:(score/5*100)+"%"}}/></div><small>{score===5?"Strong password":score>=3?"Getting stronger":"Use a longer, mixed-character password"}</small><ul>{["12+ characters","Lowercase letter","Uppercase letter","Number","Symbol"].map((rule,i)=><li className={strength[i]?"met":""} key={rule}>{strength[i]?"✓":"○"} {rule}</li>)}</ul></div>}
     {mode==="signup"&&<><label>Confirm password<input type={showPassword?"text":"password"} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required/></label><label className="account-consent"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>I agree to the <a href="https://clevotech.github.io/nexora-secure-vault/terms" target="_blank" rel="noreferrer">Terms</a> and <a href="https://clevotech.github.io/nexora-secure-vault/privacy" target="_blank" rel="noreferrer">Privacy Notice</a>.</span></label></>}
     <button className="primary wide" type="submit" disabled={busy}>{busy?"Please wait…":mode==="signup"?"Create secure account":mode==="signin"?"Sign in securely":"Send reset link"}</button>
    </form>
    {mode==="signin"&&<button className="account-text-button" type="button" onClick={()=>resetForm("reset")}>Forgot password?</button>}
    {mode==="reset"&&<button className="account-text-button" type="button" onClick={()=>resetForm("signin")}>Back to sign in</button>}
   </>}
   {message&&<p className="account-message" role="status" aria-live="polite">{message}</p>}
   {error&&<p className="account-error" role="alert">{error}</p>}
   <div className="account-security-note"><span>⌑</span><p>Never share your password or verification link. Email verification and reset links are handled by Supabase; keep recovery email access secure.</p></div>
  </section>
 </div>;
}
