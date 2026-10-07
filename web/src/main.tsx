import React,{useRef,useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import {open,save} from "@tauri-apps/plugin-dialog";
import {createRoot} from "react-dom/client";
import {encryptBrowserFile,decryptBrowserFile} from "./streaming";
import "./styles.css";

type Log={id:string;op:string;file:string;time:string;status:string};
const key="nexora-audit-v1";
const load=():Log[]=>{try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return[]}};
const saveLogs=(x:Log[])=>localStorage.setItem(key,JSON.stringify(x.slice(0,100)));
const download=(bytes:Uint8Array,name:string)=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([bytes as BlobPart]));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};

function App(){
 const[file,setFile]=useState<File|null>(null),[password,setPassword]=useState(""),[status,setStatus]=useState("Ready when you are."),[progress,setProgress]=useState(0),[busy,setBusy]=useState(false),[logs,setLogs]=useState(load),cancel=useRef<AbortController|null>(null);
 const add=(op:string,name:string,status:string)=>{const l={id:crypto.randomUUID(),op,file:name,time:new Date().toISOString(),status};const n=[l,...logs];setLogs(n);saveLogs(n)};
 const run=async(op:"encrypt"|"decrypt")=>{
  if("__TAURI_INTERNALS__" in window){
   const input=await open({multiple:false,directory:false,title:op==="encrypt"?"Choose file to encrypt":"Choose .nsv file to decrypt"});
   if(!input||Array.isArray(input))return;
   const name=String(input).split(/[\\/]/).pop()||"file";
   const suggested=op==="encrypt"?name+".nsv":name.replace(/\.nsv$/i,"")||"decrypted-file";
   const output=await save({defaultPath:suggested,title:op==="encrypt"?"Save encrypted vault":"Save decrypted file"});
   if(!output)return;
   setBusy(true);setProgress(0);setStatus(op==="encrypt"?"Encrypting with AES-256-GCM…":"Decrypting and verifying integrity…");
   try{
    await invoke(op==="encrypt"?"encrypt_nsv1":"decrypt_nsv1",op==="encrypt"?{input:String(input),output,password,fileName:name,createdAt:new Date().toISOString(),operationId:crypto.randomUUID().replace(/-/g,"")}:{input:String(input),output,password});
    add(op,name,"Success");setProgress(100);setStatus(op==="encrypt"?"Vault created successfully.":"File restored and integrity verified.");
   }catch(e){add(op,name,"Failed");setStatus(e instanceof Error?e.message:"Operation failed")}finally{setBusy(false);setPassword("")}
   return;
  }
  if(!file||!password){setStatus("Select a file and enter a password.");return}
  cancel.current=new AbortController();setBusy(true);setProgress(0);setStatus(op==="encrypt"?"Encrypting locally…":"Decrypting locally…");
  try{
   const total=file.size;const update=(n:number)=>setProgress(total===0?100:Math.min(100,Math.round(n/total*100)));
   if(op==="encrypt"){const r=await encryptBrowserFile(file,password,update,cancel.current.signal);download(r.data,file.name+".nsv");add(op,file.name,"Success");setStatus("Vault created successfully.")}
   else{const r=await decryptBrowserFile(file,password,update,cancel.current.signal);download(r.data,r.header.originalName);add(op,r.header.originalName,"Success");setStatus("File restored and integrity verified.")}
  }catch(e){const msg=e instanceof DOMException&&e.name==="AbortError"?"Operation cancelled":e instanceof Error?e.message:"Operation failed";add(op,file.name,msg==="Operation cancelled"?"Cancelled":"Failed");setStatus(msg)}
  finally{cancel.current=null;setBusy(false);setPassword("")}
 };
 return <main className="shell">
  <header className="hero">
   <div className="brand-mark"><span>N</span></div>
   <div className="eyebrow">NEXORA <em>SECURE VAULT</em></div>
   <h1>Protect what <span>matters.</span></h1>
   <p>Private, authenticated file encryption built for people who take their data seriously.</p>
   <div className="trust-row"><span>● AES-256-GCM</span><span>● Argon2id</span><span>● Local-first</span></div>
  </header>
  <section className="card vault-card">
   <div className="section-title"><div><span className="kicker">SECURE WORKSPACE</span><h2>Encrypt or decrypt a file</h2></div><div className="lock">⌁</div></div>
   <label className={"drop "+(file?"selected":"")}>
    <input type="file" onChange={e=>setFile(e.target.files?.[0]??null)}/>
    <div className="upload-icon">{file?"✓":"↑"}</div>
    <strong>{file?file.name:"Choose a file"}</strong>
    <span>{file?((file.size/1048576).toFixed(2)+" MB • Ready to process"):"Drop it here or tap to browse • Processing stays local"}</span>
   </label>
   <div className="field">
    <label htmlFor="password">Encryption password</label>
    <input id="password" className="password" type="password" autoComplete="new-password" placeholder="Enter a strong password" value={password} onChange={e=>setPassword(e.target.value)}/>
   </div>
   <div className="actions">
    <button className="primary" disabled={busy||!file} onClick={()=>run("encrypt")}><span>Encrypt</span><small>→</small></button>
    <button className="secondary" disabled={busy||!file} onClick={()=>run("decrypt")}><span>Decrypt</span><small>→</small></button>
    {busy&&<button className="cancel" onClick={()=>cancel.current?.abort()}>Cancel</button>}
   </div>
   {busy&&<div className="progress-wrap"><div className="progress"><i style={{width:progress+"%"}}/></div><span>{progress}%</span></div>}
   <div className="status"><span className={busy?"pulse":"dot"}></span>{status}{busy&&<b>{progress}%</b>}</div>
  </section>
  <section className="feature-grid">
   <div><span>01</span><strong>Private by design</strong><p>Browser processing keeps plaintext off a server.</p></div>
   <div><span>02</span><strong>Authenticated</strong><p>Tamper detection is built into every encrypted chunk.</p></div>
   <div><span>03</span><strong>Cross-platform</strong><p>Designed around one interoperable NSV1 format.</p></div>
  </section>
  <section className="audit">
   <div className="row"><div><span className="kicker">LOCAL HISTORY</span><h2>Recent activity</h2></div><button className="small" onClick={()=>{setLogs([]);saveLogs([])}} disabled={!logs.length}>Clear</button></div>
   {logs.length?logs.map(x=><div className="log" key={x.id}><div className="log-op">{x.op==="encrypt"?"↑":"↓"}</div><div><b>{x.file}</b><span>{new Date(x.time).toLocaleString()}</span></div><strong className={x.status==="Success"?"ok":""}>{x.status}</strong></div>):<div className="empty">No activity yet. Your local history will appear here.</div>}
   <small>Passwords, raw encryption keys and plaintext contents are never stored in this activity log.</small>
  </section>
  <footer><span>NEXORA</span><span>SECURE BY DESIGN</span><span>NSV1 • v0.2</span></footer>
 </main>
}
createRoot(document.getElementById("root")!).render(<App/>);
