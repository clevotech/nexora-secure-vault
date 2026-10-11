const OPENAI="https://api.openai.com/v1";
function key(){const k=process.env.NEXORA_OPENAI_API_KEY;if(!k)throw new Error("OpenAI media provider is not configured");return k;}
async function parse(r:Response){const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||d?.error||d?.message||`Media provider failed (${r.status})`);return d;}

export async function generateImage(prompt:string,model=process.env.NEXORA_IMAGE_MODEL||"gemini-2.5-flash-image"){
  if(!prompt||prompt.length>32000)throw new Error("Invalid image prompt");
  const googleKey=process.env.NEXORA_GOOGLE_API_KEY;
  if(googleKey){
    const selected=model.startsWith("gemini-")?model:"gemini-2.5-flash-image";
    const base=(process.env.NEXORA_GOOGLE_BASE_URL||"https://generativelanguage.googleapis.com/v1beta").replace(/\/$/,"");
    const r=await fetch(`${base}/models/${selected}:generateContent?key=${encodeURIComponent(googleKey)}`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseModalities:["TEXT","IMAGE"]}})
    });
    const d=await parse(r);
    const parts=d?.candidates?.[0]?.content?.parts||[];
    const item=parts.find((p:{inlineData?:{data?:string;mimeType?:string};inline_data?:{data?:string;mime_type?:string}})=>Boolean(p.inlineData?.data||p.inline_data?.data));
    const imageData=item?.inlineData?.data||item?.inline_data?.data;
    if(imageData)return {model:selected,imageBase64:imageData,mimeType:item?.inlineData?.mimeType||item?.inline_data?.mime_type||"image/png",provider:"google"};
    throw new Error("Gemini returned no image. Check that image generation is enabled for your API key and model.");
  }
  const r=await fetch(`${OPENAI}/images/generations`,{method:"POST",headers:{Authorization:`Bearer ${key()}`,"Content-Type":"application/json"},body:JSON.stringify({model,prompt})});
  const d=await parse(r);const item=d?.data?.[0];if(!item?.b64_json)throw new Error("Image provider returned no image data");
  return {model,imageBase64:item.b64_json,provider:"openai"};
}

export async function transcribe(audioBase64:string,filename="audio.webm"){
  if(!audioBase64||audioBase64.length>35_000_000)throw new Error("Invalid audio payload");
  const bytes=Buffer.from(audioBase64,"base64");const form=new FormData();
  form.append("file",new Blob([bytes],{type:"audio/webm"}),filename);form.append("model",process.env.NEXORA_TRANSCRIBE_MODEL||"gpt-transcribe");
  const r=await fetch(`${OPENAI}/audio/transcriptions`,{method:"POST",headers:{Authorization:`Bearer ${key()}`},body:form});
  const d=await parse(r);if(typeof d?.text!=="string")throw new Error("Transcription provider returned no text");return {text:d.text,model:process.env.NEXORA_TRANSCRIBE_MODEL||"gpt-transcribe"};
}

export async function speak(input:string,voice=process.env.NEXORA_TTS_VOICE||"marin"){
  if(!input||input.length>4096)throw new Error("Invalid speech input");
  const r=await fetch(`${OPENAI}/audio/speech`,{method:"POST",headers:{Authorization:`Bearer ${key()}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.NEXORA_TTS_MODEL||"gpt-4o-mini-tts",voice,input,response_format:"mp3"})});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d?.error?.message||`Speech provider failed (${r.status})`);}
  return {audioBase64:Buffer.from(await r.arrayBuffer()).toString("base64"),model:process.env.NEXORA_TTS_MODEL||"gpt-4o-mini-tts",format:"mp3"};
}
