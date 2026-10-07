import {encryptStream,decryptStream} from "../../core/src/stream";
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
 const target=await saveTarget(file.name+".nsv");let written=0;
 try{const header=await encryptStream(fileSource(file,signal),async c=>{written+=c.length;onChunk?.(written);await target.sink(c)},password,file.name,file.size);await target.close();return{header}}
 catch(e){try{await target.close()}catch{}throw e}
}
export async function decryptBrowserFile(file:File,password:string,onChunk?:(bytes:number)=>void,signal?:AbortSignal){
 const target=await saveTarget(file.name.replace(/\.nsv$/i,"")||"decrypted-file");let written=0;
 try{const header=await decryptStream(fileSource(file,signal),async c=>{written+=c.length;onChunk?.(written);await target.sink(c)},password);await target.close();return{header}}
 catch(e){try{await target.close()}catch{}throw e}
}
