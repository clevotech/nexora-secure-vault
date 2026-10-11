import {encryptStream,decryptStream,restoreHeaderName} from "../../core/src/stream";
import {decodeHeader} from "../../core/src/protocol";
async function* fileSource(file:File,signal?:AbortSignal){const reader=file.stream().getReader();try{while(true){if(signal?.aborted)throw new DOMException("Operation cancelled","AbortError");const r=await reader.read();if(r.done)break;yield r.value}}finally{reader.releaseLock()}}
type SaveHandle={createWritable:()=>Promise<WritableStream<Uint8Array>>};
async function saveTarget(name:string):Promise<{sink:(c:Uint8Array)=>Promise<void>;close:()=>Promise<void>}>{
 const picker=(window as any).showSaveFilePicker;
 if(typeof picker!=="function")throw new Error("Streaming file save is not supported by this browser. Use a current Chromium-based browser or the desktop app.");
 const handle=await picker({suggestedName:name});
 const writable=await (handle as SaveHandle).createWritable();const writer=writable.getWriter();
 return {sink:async c=>{await writer.ready;await writer.write(c)},close:async()=>{await writer.close()}};
}
export async function encryptBrowserFile(file:File,password:string,onChunk?:(bytes:number)=>void,signal?:AbortSignal){
 const target=await saveTarget("nexora-vault-"+crypto.randomUUID()+".nsv");let written=0;
 try{const header=await encryptStream(fileSource(file,signal),async c=>{written+=c.length;onChunk?.(written);await target.sink(c)},password,file.name,file.size);await target.close();return{header}}
 catch(e){try{await target.close()}catch{}throw e}
}
export async function decryptBrowserFile(file:File,password:string,onChunk?:(bytes:number)=>void,signal?:AbortSignal){
 const prefix=new Uint8Array(await file.slice(0,4).arrayBuffer());if(prefix.length!==4)throw new Error("Invalid Nexora container");
 const hlen=new DataView(prefix.buffer,prefix.byteOffset,4).getUint32(0,true);if(hlen===0||hlen>64*1024)throw new Error("Invalid Nexora container header");
 const headerBytes=new Uint8Array(await file.slice(4,4+hlen).arrayBuffer());if(headerBytes.length!==hlen)throw new Error("Incomplete Nexora container header");
 const header=restoreHeaderName(decodeHeader(headerBytes),password);
 const target=await saveTarget(header.originalName||"decrypted-file");let written=0;
 try{const restored=await decryptStream(fileSource(file,signal),async c=>{written+=c.length;onChunk?.(written);await target.sink(c)},password);await target.close();return{header:restored}}
 catch(e){try{await target.close()}catch{}throw e}
}
