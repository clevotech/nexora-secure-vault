# Nexora AI Premium Video Slash Commands

## Presets
- `/ngo-premium` — NGO recruitment and impact storytelling.
- `/cinematic` — polished commercial cinematography.
- `/ugc` — authentic creator-style performance.
- `/documentary` — observational realism.
- `/commercial` — premium brand advertisement.

## Visuals and cinematography
- `/realism` — realistic skin, anatomy, motion and physics.
- `/camera` — purposeful shot sizes and angles.
- `/lens` — plausible lens and depth-of-field choices.
- `/movement` — one clear camera move per shot.
- `/lighting` — motivated, consistent lighting.
- `/environment` — grounded location detail.
- `/action` — achievable timed action beats.
- `/emotion` — subtle, credible human emotion.

## Audio and performance
- `/natural-dialogue` — spontaneous, conversational speech.
- `/voice` — consistent voice identity and delivery.
- `/accent` — natural, respectful regional accent.
- `/audio` — clear dialogue and realistic ambience.
- `/no-music` — no soundtrack; only explicitly requested ambience/effects.

## Continuity and editing
- `/continuity` — preserve face, wardrobe, props, location and palette.
- `/reference-lock` — use uploaded references as identity/style anchors.
- `/sequence` — coherent narrative progression.
- `/six-scenes` — six-scene storyboard arc.
- `/transition` — motivated cuts and match transitions.
- `/storyboard` — shot-by-shot production plan.

## Format, culture and finishing
- `/africa` — accurately represent the specified African country/community.
- `/vertical` — mobile-first 9:16 framing.
- `/landscape` — 16:9 widescreen composition.
- `/grade` — consistent professional color grade.
- `/quality` — target best quality supported by the selected provider.
- `/no-ai` — avoid synthetic artifacts and impossible motion.
- `/longform` — plan multi-clip long-form assembly within provider limits.

## Recommended six-scene command
`/ngo-premium /realism /documentary /camera /lens /movement /lighting /action /emotion /natural-dialogue /continuity /sequence /transition /africa /grade /quality /no-ai /six-scenes`

## Production rule
Commands expand into plain-language instructions; they do not override model/API hard limits. Set aspect ratio, resolution, duration, audio, and reference assets through the corresponding controls. For long-form videos, generate and assemble multiple clips if the selected provider cannot render the requested duration in one job. Always preserve the user's specified language, country, identity references, brand assets, and no-music requirement.


## Camera angles, shot sizes and focus
- `/pov` — Point-of-view shot.
- `/overtheshoulder` — Over-the-shoulder composition.
- `/lowangle` — Low-angle shot.
- `/highangle` — High-angle shot.
- `/eyelevel` — Eye-level shot.
- `/dutchnangle` — Intentional Dutch tilt.
- `/establishing` — Wide establishing shot.
- `/wideshot` — Wide shot.
- `/mediumshot` — Medium shot.
- `/closeup` — Close-up.
- `/extremecloseup` — Extreme close-up detail.
- `/rackfocus` — Rack focus between subjects.

## Camera movements and styles
- `/zoomin` — Smooth optical zoom in.
- `/zoomout` — Smooth optical zoom out.
- `/pushin` — Physical camera push-in.
- `/pullout` — Physical camera pull-out.
- `/panleft` — Pan camera left.
- `/panright` — Pan camera right.
- `/tiltup` — Tilt camera upward.
- `/tiltdown` — Tilt camera downward.
- `/trackleft` — Track laterally left.
- `/trackright` — Track laterally right.
- `/dollyin` — Dolly toward subject.
- `/dollyout` — Dolly away from subject.
- `/orbit` — Controlled orbit around subject.
- `/craneup` — Crane or jib rises.
- `/cranedown` — Crane or jib descends.
- `/handheld` — Natural handheld camera.
- `/gimbal` — Stabilized gimbal tracking.
- `/drone` — Aerial drone reveal.
- `/lockedoff` — Locked-off static frame.
- `/whippan` — Fast whip pan.
- `/reveal` — Gradual subject reveal.

## Transitions and timing
- `/matchcut` — Visual match cut.
- `/actionmatch` — Action match transition.
- `/crossdissolve` — Gentle cross-dissolve.
- `/hardcut` — Clean hard cut.
- `/slowmotion` — Cinematic slow motion.
- `/timelapse` — Time-lapse sequence.
- `/speedramp` — Controlled speed ramp.

## Usage examples
- `/zoomin /closeup` — smoothly tighten framing into a close-up.
- `/dollyin /eyelevel /rackfocus` — physically approach the subject at eye level and shift focus naturally.
- `/panright /matchcut` — pan right, then transition using a motivated visual match.
- `/establishing /drone /hardcut /mediumshot` — aerial establishing reveal followed by a clean cut to a medium shot.

Commands are case-insensitive, so `/Zoomin` also works. Combine only a few compatible commands per shot; contradictory camera moves may produce unpredictable results. These commands add prompt instructions and do not guarantee a provider supports every camera behavior natively.
