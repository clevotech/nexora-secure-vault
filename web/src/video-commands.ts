export type VideoSlashCommand = { command: string; category: string; description: string; instruction: string };

export const VIDEO_SLASH_COMMANDS: VideoSlashCommand[] = [
{command:"/ngo-premium",category:"Presets",description:"Premium NGO recruitment / impact film",instruction:"Create a human-centered NGO impact story with authentic community interactions, dignity, practical detail, hope, and a clear call to action."},
{command:"/cinematic",category:"Presets",description:"High-end commercial",instruction:"Use professional cinematography, intentional composition, motivated movement, controlled depth of field, purposeful pacing, and believable production design."},
{command:"/ugc",category:"Presets",description:"Natural creator-style video",instruction:"Use direct-to-camera delivery, natural gestures, spontaneous reactions, realistic framing, and conversational energy; avoid overacting."},
{command:"/documentary",category:"Presets",description:"Observational realism",instruction:"Use documentary realism, candid behavior, available-light logic, respectful observational framing, and understated editing."},
{command:"/realism",category:"Visuals",description:"Photorealistic people and physics",instruction:"Prioritize natural skin texture, plausible anatomy, realistic hands, contact physics, shadows, and motion blur."},
{command:"/camera",category:"Cinematography",description:"Shot sizes and angles",instruction:"Choose a purposeful establishing wide, medium, close-up, or detail shot and a story-motivated camera angle for each shot."},
{command:"/lens",category:"Cinematography",description:"Lens and depth of field",instruction:"Use plausible 24–35mm wide, 35–50mm natural medium, or 70–85mm portrait lens language; use depth of field only when it supports the story."},
{command:"/movement",category:"Cinematography",description:"Smooth camera movement",instruction:"Give each shot one clear camera move: slow push-in, tracking, pan, tilt, or locked-off frame. Avoid conflicting moves."},
{command:"/lighting",category:"Visuals",description:"Motivated consistent lighting",instruction:"Specify light source, direction, softness, contrast, and color temperature; keep lighting consistent between adjacent shots."},
{command:"/environment",category:"Visuals",description:"Grounded location details",instruction:"Use believable foreground, background, weather, practical objects, and culturally appropriate location details."},
{command:"/action",category:"Performance",description:"Timed physical action",instruction:"Describe one achievable primary action per shot with a natural start, movement, reaction, and finish."},
{command:"/emotion",category:"Performance",description:"Subtle human emotion",instruction:"Show emotion through credible eye focus, micro-expressions, breath, posture, pauses, and restrained gestures."},
{command:"/natural-dialogue",category:"Audio",description:"Human spontaneous speech",instruction:"Use natural contractions, pauses, breath, conversational rhythm, and authentic reactions; avoid robotic narration."},
{command:"/voice",category:"Audio",description:"Consistent voice identity",instruction:"Keep voice timbre, pace, energy, microphone perspective, and vocal identity consistent between scenes; use voice references only when supported."},
{command:"/accent",category:"Audio",description:"Respectful regional accent",instruction:"Use the selected language and regional accent naturally; avoid caricature, exaggerated accents, or incompatible vocabulary."},
{command:"/audio",category:"Audio",description:"Realistic soundscape",instruction:"Keep dialogue clear with subtle environmental ambience and action-matched sound effects; avoid clipping, competing audio, and unwanted reverb."},
{command:"/no-music",category:"Audio",description:"No soundtrack",instruction:"No background music, soundtrack, or musical stings. Use only requested dialogue and relevant natural ambience/effects; honor silence if requested."},
{command:"/continuity",category:"Continuity",description:"Identity and scene continuity",instruction:"Preserve face, skin tone, hair, proportions, wardrobe, accessories, props, location layout, lighting logic, and palette across shots unless scripted otherwise."},
{command:"/reference-lock",category:"Continuity",description:"Honor reference assets",instruction:"Treat uploaded images as identity, wardrobe, brand, or style anchors and reference videos as motion guidance only when supported; do not invent changes to key details."},
{command:"/sequence",category:"Editing",description:"Coherent story progression",instruction:"Build a coherent opening, development, peak, and purposeful ending; vary shot framing and avoid repetitive visuals."},
{command:"/six-scenes",category:"Editing",description:"Six-scene storyboard",instruction:"Structure six scenes: hook/context; introduce person or need; show challenge; demonstrate solution; show credible impact; finish with a natural call to action. Maintain continuity."},
{command:"/transition",category:"Editing",description:"Motivated transitions",instruction:"Use simple motivated cuts, match cuts, action matches, or restrained dissolves; preserve eyelines, screen direction, movement, exposure, and color."},
{command:"/storyboard",category:"Planning",description:"Shot-by-shot plan",instruction:"Plan scene purpose, shot size, angle, lens, movement, action, lighting, environment, audio, duration, transition, and continuity before generation."},
{command:"/africa",category:"Cultural accuracy",description:"Authentic African setting",instruction:"Represent the specified African country and community accurately in language, clothing, architecture, transport, and daily life; avoid generic regional cues and stereotypes."},
{command:"/vertical",category:"Format",description:"Vertical 9:16",instruction:"Compose for 9:16 with clear subject hierarchy, safe headroom, and key action kept in the central safe area."},
{command:"/landscape",category:"Format",description:"Widescreen 16:9",instruction:"Compose for 16:9 with deliberate horizontal balance, cinematic blocking, negative space, and readable action."},
{command:"/commercial",category:"Presets",description:"Premium advertisement",instruction:"Tell a concise product/service story with believable benefits, premium but truthful production value, and a persuasive ending; preserve supplied logos accurately."},
{command:"/grade",category:"Post-production",description:"Professional color grade",instruction:"Use natural skin tones, controlled highlights, detailed shadows, consistent white balance, coherent palette, and shot-to-shot exposure matching."},
{command:"/quality",category:"Post-production",description:"Maximum supported quality",instruction:"Target the best resolution and quality actually supported by the provider; prioritize stable motion, crisp details, clean edges, and temporal consistency."},
{command:"/no-ai",category:"Quality control",description:"Reduce synthetic artifacts",instruction:"Avoid waxy skin, uncanny eyes, duplicated people, warped fingers, changing faces, melting props, flicker, jitter, ghosting, impossible reflections, and unstable logos/text."},
{command:"/longform",category:"Planning",description:"Multi-clip long-form workflow",instruction:"Plan scenes within actual per-clip limits, keep character/location/style bibles consistent, and assemble multiple clips with transitions and quality control. Never represent a short clip as a finished long-form film."}
];

const commandMap = new Map(VIDEO_SLASH_COMMANDS.map(item => [item.command, item]));
export function expandVideoCommands(input: string): { prompt: string; applied: string[]; unknown: string[] } {
  const applied: string[] = [];
  const unknown: string[] = [];
  const prompt = input.replace(/(^|\\s)(\\/[a-z][a-z0-9-]*)(?=\\s|$)/gi, (whole, prefix: string, token: string) => {
    const command = token.toLowerCase();
    if (commandMap.has(command)) { applied.push(command); return prefix; }
    unknown.push(command);
    return whole;
  }).replace(/[ \\t]{2,}/g, " ").replace(/\\n{3,}/g, "\\n\\n").trim();
  const unique = [...new Set(applied)];
  return { prompt: [prompt, ...unique.map(command => commandMap.get(command)!.instruction)].filter(Boolean).join("\\n\\n"), applied: unique, unknown: [...new Set(unknown)] };
}
