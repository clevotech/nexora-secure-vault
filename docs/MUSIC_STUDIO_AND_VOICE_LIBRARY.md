# Nexora Music Studio and Reusable Voice Library

## User capabilities
- Music Studio offers song prompts, original lyrics, broad genre selection, mood, a BPM control with slider and presets, musical key, scale/mode, standard or custom chord progressions, arrangement structure, instrumental-only mode, and requested durations from 30 seconds to 10 minutes. Each session also supports multi-select instruments, comma-separated custom instruments, per-instrument arrangement direction, and an optional list of instruments to exclude. Instrument selections are passed to the configured provider as `instruments`, `customInstruments`, `instrumentDirection`, and `excludedInstruments`; actual adherence depends on provider support.
- Users may import voice samples up to 5 MB. Samples are saved in the browser's IndexedDB voice library for reuse in video and music sessions on that same browser/device. Users can name and remove imported voices. In Music Studio, one imported voice can be assigned as lead vocalist and up to eight additional imported voices can be selected as backup singers, with a separate custom-lyrics field for each selected backup vocalist; a provider must support multi-reference vocal generation to perform distinct vocal roles.
- Before importing a voice, the UI asks the user to confirm ownership or permission from the speaker.
- Users may upload a reference track up to 12 MB and must confirm that they own or have permission to use it. A beat-only option instructs the provider to use broad rhythm, tempo, instrumentation, or production guidance while creating a new melody and arrangement.
- Generated audio is previewable and downloadable when the provider returns an audio asset.

## Provider setup
Music generation uses a configurable asynchronous adapter in `backend/src/music.ts`. Configure these backend environment variables on the hosting service:
- `NEXORA_MUSIC_API_URL`: base URL of a compatible music-generation API. It accepts a POST with JSON fields including `prompt`, `genre`, `durationSeconds`, `bpm`, `mood`, `structure`, `bpm`, `key`, `scale`, `chordProgression`, `customChordProgression`, `instruments`, `customInstruments`, `instrumentDirection`, `excludedInstruments`, `lyrics`, `instrumental`, `voiceReferenceAudio`, `leadVocalist`, `backupVoiceReferences` (including per-voice `lyrics`), `backupVocalLyrics`, `vocalArrangement`, `referenceTrackAudio`, and rights confirmation.
- `NEXORA_MUSIC_API_KEY`: optional bearer token if required by the selected provider.
- `NEXORA_MUSIC_TIMEOUT_MS`: optional generation timeout; defaults to 30 minutes.
- `NEXORA_MUSIC_POLL_MS`: optional poll interval; defaults to 5 seconds.

The provider may return `audioBase64` directly, or a `jobId`/ `id`; for async jobs the adapter polls `{baseUrl}/{jobId}` until a completed status and an `audioUrl`/ `downloadUrl`/ `url` is returned. The worker stores the audio in configured S3-compatible object storage and exposes it through Nexora's authenticated asset delivery.

A provider must explicitly support full-length generation, custom voice references, and/or reference-track analysis for each feature to work. The UI does not claim those capabilities are active without a compatible provider. Do not put provider keys in frontend code.

## Rights and originality
- Use voice recordings only when the user owns them or has permission from the speaker.
- Reference tracks must be owned or licensed by the user.
- The service instructs providers to create original music and not reproduce copyrighted lyrics, melodies, master recordings, or a named artist's distinctive voice.
- Provider API quotas, terms, safety checks, and capability limits still apply.

## Storage
Imported voice samples are stored in browser IndexedDB on the user's current browser/device, not in a shared account library. Clearing browser site data or switching devices can remove or hide these local samples. When selected for generation, sample data is sent to the configured provider through the authenticated backend job. For production, explain the provider's retention terms and implement encrypted server-side voice storage only with explicit user consent.
