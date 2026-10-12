const OPENAI="https://api.openai.com/v1";
const GOOGLE_DEFAULT="https://generativelanguage.googleapis.com/v1beta";
function openAIKey(){const k=process.env.NEXORA_OPENAI_API_KEY;if(!k)throw new Error("Media provider not configured. Set NEXORA_GOOGLE_API_KEY or NEXORA_OPENAI_API_KEY.");return k;}
function googleConfig(){const key=process.env.NEXORA_GOOGLE_API_KEY;if(!key)throw new Error("Google Gemini media provider is not configured");return {key,base:(process.env.NEXORA_GOOGLE_BASE_URL||GOOGLE_DEFAULT).replace(/\/$/,"")};}
async function parse(r:Response){const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||d?.error||d?.message||`Media provider failed (${r.status})`);return d;}
async function googleGenerate(model:string,contents:unknown,generationConfig?:unknown){
  const {key,base}=googleConfig();
  const r=await fetch(`${base}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents,...(generationConfig?{generationConfig}:{})})});
  return parse(r);
}
async function googleInteraction(model:string,input:unknown){
  const {key,base}=googleConfig();
  const r=await fetch(`${base}/interactions`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},body:JSON.stringify({model,input})});
  return parse(r);
}
function pcmToWav(pcm:Buffer,sampleRate=24000,channels=1){
  const header=Buffer.alloc(44);header.write("RIFF",0);header.writeUInt32LE(36+pcm.length,4);header.write("WAVE",8);header.write("fmt ",12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(channels,22);header.writeUInt32LE(sampleRate,24);header.writeUInt32LE(sampleRate*channels*2,28);header.writeUInt16LE(channels*2,32);header.writeUInt16LE(16,34);header.write("data",36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);
}

export type ImageReference={name?:string;dataUrl:string};
export type ImageOptions={aspectRatio?:string;resolution?:string;quality?:string;format?:string};
export async function generateImage(prompt:string,model=process.env.NEXORA_IMAGE_MODEL||"gpt-image-1",referenceImages:ImageReference[]=[],options:ImageOptions={}){
  if(!prompt||prompt.length>32000)throw new Error("Invalid image prompt");
  if(referenceImages.length>2||referenceImages.some(x=>typeof x.dataUrl!=="string"||!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(x.dataUrl)))throw new Error("Provide up to 2 valid PNG, JPEG, or WebP reference images.");
  const googleKey=process.env.NEXORA_GOOGLE_API_KEY;
  if(googleKey){
    try{
    const selected=model.startsWith("gemini-")?model:"gemini-3.1-flash-image";
    const requestParts:unknown[]=[{text:prompt},...referenceImages.map(ref=>{const match=ref.dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);if(!match)throw new Error("Unsupported reference image format");return {inlineData:{mimeType:match[1]==="image/jpg"?"image/jpeg":match[1],data:match[2]}}})];
    const aspectRatio=["1:1","3:2","2:3","4:3","3:4","16:9","9:16","21:9"].includes(options.aspectRatio||"")?options.aspectRatio:"1:1";
    const imageSize=["1K","2K","4K"].includes(options.resolution||"")?options.resolution:"1K";
    const d=await googleGenerate(selected,[{role:"user",parts:requestParts}],{responseModalities:["TEXT","IMAGE"],imageConfig:{aspectRatio,imageSize}});
    const responseParts=(d?.candidates?.[0]?.content?.parts||[]) as {inlineData?:{data?:string;mimeType?:string};inline_data?:{data?:string;mime_type?:string}}[];
    const item=responseParts.find(p=>Boolean(p.inlineData?.data||p.inline_data?.data));
    const imageData=item?.inlineData?.data||item?.inline_data?.data;
    if(imageData)return {model:selected,imageBase64:imageData,mimeType:item?.inlineData?.mimeType||item?.inline_data?.mime_type||"image/png",provider:"google"};
    throw new Error("Gemini returned no image. Check access and image-generation quota for gemini-3.1-flash-image.");
    }catch(error){
      // OpenAI can be used as a quota fallback only for text-to-image. Do not
      // silently discard user-supplied reference images.
      if(!process.env.NEXORA_OPENAI_API_KEY||referenceImages.length)throw error;
    }
  }
  if(referenceImages.length)throw new Error("Image reference inputs require an available Google image quota; the OpenAI fallback does not accept these references.");
  const r=await fetch(`${OPENAI}/images/generations`,{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`,"Content-Type":"application/json"},body:JSON.stringify({model,prompt,size:({ "1:1":"1024x1024","3:2":"1536x1024","2:3":"1024x1536","4:3":"1536x1024","3:4":"1024x1536","16:9":"1536x1024","9:16":"1024x1536","21:9":"1536x1024"} as Record<string,string>)[options.aspectRatio||"1:1"],quality:["low","medium","high"].includes(options.quality||"")?options.quality:"high",output_format:["png","jpeg","webp"].includes(options.format||"")?options.format:"png"})});
  const d=await parse(r);const item=d?.data?.[0];if(!item?.b64_json)throw new Error("Image provider returned no image data");return {model,imageBase64:item.b64_json,provider:"openai"};
}

export async function transcribe(audioBase64:string,filename="audio.webm"){
  if(!audioBase64||audioBase64.length>35_000_000)throw new Error("Invalid audio payload");
  if(process.env.NEXORA_GOOGLE_API_KEY){
    try{
    const mimeType=/\.wav$/i.test(filename)?"audio/wav":/\.mp3$/i.test(filename)?"audio/mpeg":/\.mp4$/i.test(filename)?"audio/mp4":"audio/webm";
    const model=process.env.NEXORA_TRANSCRIBE_MODEL?.startsWith("gemini-")?process.env.NEXORA_TRANSCRIBE_MODEL:"gemini-3.8-flash";
    const d=await googleInteraction(model,[{type:"text",text:"Transcribe the spoken words in this audio accurately. Return only the transcription, without commentary."},{type:"audio",data:audioBase64,mime_type:mimeType}]);
    const transcript=typeof d?.output_text==="string"?d.output_text:(d?.steps||[]).filter((step:{type?:string})=>step.type==="model_output").flatMap((step:{content?:{type?:string,text?:string}[]})=>step.content||[]).filter((item:{type?:string})=>item.type==="text").map((item:{text?:string})=>item.text||"").join("").trim();
    if(!transcript)throw new Error(d?.errors?.map((e:{message?:string})=>e.message).filter(Boolean).join("; ")||"Gemini returned no transcription. Check audio format and Google API quota.");
    return {text:transcript,model,provider:"google"};
    }catch(error){
      if(!process.env.NEXORA_OPENAI_API_KEY)throw error;
    }
  }
  const bytes=Buffer.from(audioBase64,"base64");const form=new FormData();
  form.append("file",new Blob([bytes],{type:"audio/webm"}),filename);form.append("model",process.env.NEXORA_TRANSCRIBE_MODEL||"gpt-transcribe");
  const r=await fetch(`${OPENAI}/audio/transcriptions`,{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`},body:form});
  const d=await parse(r);if(typeof d?.text!=="string")throw new Error("Transcription provider returned no text");return {text:d.text,model:process.env.NEXORA_TRANSCRIBE_MODEL||"gpt-transcribe",provider:"openai"};
}

export async function speak(input:string,voice=process.env.NEXORA_TTS_VOICE||"Kore"){
  if(!input||input.length>4096)throw new Error("Invalid speech input");
  if(process.env.NEXORA_GOOGLE_API_KEY){
    try{
    const model=process.env.NEXORA_TTS_MODEL?.startsWith("gemini-")?process.env.NEXORA_TTS_MODEL:"gemini-2.5-flash-preview-tts";
    const d=await googleGenerate(model,[{role:"user",parts:[{text:input}]}],{responseModalities:["AUDIO"],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}});
    const parts=d?.candidates?.[0]?.content?.parts||[];
    const item=parts.find((p:{inlineData?:{data?:string;mimeType?:string};inline_data?:{data?:string;mime_type?:string}})=>Boolean(p.inlineData?.data||p.inline_data?.data));
    const encoded=item?.inlineData?.data||item?.inline_data?.data;
    if(!encoded)throw new Error("Gemini returned no speech audio. Check TTS model access and Google API quota.");
    const mime=item?.inlineData?.mimeType||item?.inline_data?.mime_type||"audio/L16;rate=24000";
    const wav=pcmToWav(Buffer.from(encoded,"base64"),Number(/rate=(\d+)/i.exec(mime)?.[1]||24000));
    return {audioBase64:wav.toString("base64"),model,format:"wav",mimeType:"audio/wav",provider:"google"};
    }catch(error){
      if(!process.env.NEXORA_OPENAI_API_KEY)throw error;
    }
  }
  const model=process.env.NEXORA_TTS_MODEL||"gpt-4o-mini-tts";
  const r=await fetch(`${OPENAI}/audio/speech`,{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`,"Content-Type":"application/json"},body:JSON.stringify({model,voice,input,response_format:"mp3"})});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d?.error?.message||`Speech provider failed (${r.status})`);}
  return {audioBase64:Buffer.from(await r.arrayBuffer()).toString("base64"),model,format:"mp3",mimeType:"audio/mpeg",provider:"openai"};
}
