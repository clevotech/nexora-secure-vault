import {encryptStream,decryptStream,restoreHeaderName} from "../../core/src/stream";
import {decodeHeader} from "../../core/src/protocol";
async function* fileSource(file:File,signal?:AbortSignal){const reader=file.stream().getReader();try{while(true){if(signal?.aborted)throw new DOMException("Operation cancelled","AbortError");const r=await reader.read();if(r.done)break;yield r.value}}finally{reader.releaseLock()}}
type SaveHandle={createWritable:()=>Promise<WritableStream<Uint8Array>>};
async function saveTarget(name:string):Promise<{sink:(c:Uint8Array)=>Promise<void>;close:()=>Promise<void>}>{
 const picker=(window as any).showSaveFilePicker;
 if(typeof picker!=="function"){const parts:Uint8Array[]=[];return {sink:async c=>{parts.push(c)},close:async()=>{const url=URL.createObjectURL(new Blob(parts,{type:"application/octet-stream"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}};}
 const handle=await picker({suggestedName:name});
 const writable=await (handle as SaveHandle).createWritable();const writer=writable.getWriter();
 return {sink:async c=>{await writer.ready;await writer.write(c)},close:async()=>{await writer.close()}};
}
const u32=(b:Uint8Array,o=0)=>new DataView(b.buffer,b.byteOffset+o,4).getUint32(0,true);
async function readHeader(file:File){
 const prefix=new Uint8Array(await file.slice(0,4).arrayBuffer());if(prefix.length!==4)throw new Error("Invalid Nexora encrypted file");
 const hlen=u32(prefix);if(hlen<1||hlen>65536)throw new Error("Invalid Nexora header");
 const headerBytes=new Uint8Array(await file.slice(4,4+hlen).arrayBuffer());
 if(headerBytes.length!==hlen)throw new Error("Incomplete Nexora header");
 return decodeHeader(headerBytes);
}
export async function encryptBrowserFile(file:File,password:string,onChunk?:(bytes:number)=>void,signal?:AbortSignal,onOutputChunk?:(chunk:Uint8Array)=>void){
 const outputName="Nexora-"+crypto.randomUUID().replace(/-/g,"").slice(0,16)+".nsv";const target=await saveTarget(outputName);let written=0;
 try{const header=await encryptStream(fileSource(file,signal),async c=>{written+=c.length;onChunk?.(written);onOutputChunk?.(c);await target.sink(c)},password,file.name,file.size);await target.close();return{header,outputName}}
 catch(e){try{await target.close()}catch{}throw e}
}
export async function decryptBrowserFile(file:File,password:string,onChunk?:(bytes:number)=>void,signal?:AbortSignal){
 const storedHeader=await readHeader(file);
 const name=restoreHeaderName(storedHeader,password);
 const target=await saveTarget(name);let written=0;
 try{const header=await decryptStream(fileSource(file,signal),async c=>{written+=c.length;onChunk?.(written);await target.sink(c)},password);await target.close();return{header}}
 catch(e){try{await target.close()}catch{}throw e}
}
