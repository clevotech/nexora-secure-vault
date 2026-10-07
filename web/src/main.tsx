import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";

function App(){
 const [file,setFile]=useState<File|null>(null);
 const [status,setStatus]=useState("Ready");
 return <main className="shell">
  <section className="hero"><div className="brand">NEXORA</div><h1>Secure Vault</h1><p>Private, authenticated file encryption and decryption.</p></section>
  <section className="card">
   <label className="drop"><input type="file" onChange={e=>setFile(e.target.files?.[0]??null)}/><strong>{file?file.name:"Choose a file"}</strong><span>{file?"Ready for secure processing":"Files are processed locally where supported"}</span></label>
   <div className="actions"><button disabled={!file} onClick={()=>setStatus("Encryption engine ready — cryptographic implementation pending")}>Encrypt</button><button className="secondary" disabled={!file} onClick={()=>setStatus("Decryption engine ready — select a Nexora container")}>Decrypt</button></div>
   <p className="status">{status}</p>
  </section>
  <section className="audit"><h2>Audit history</h2><p>Encryption and decryption timestamps, operation IDs, algorithms and integrity results will appear here. Secrets are never recorded.</p></section>
 </main>
}
createRoot(document.getElementById("root")!).render(<App/>);
