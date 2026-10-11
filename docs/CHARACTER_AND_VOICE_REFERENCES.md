# Nexora Character References, Custom Voices, and Regional Delivery

## User-facing capabilities
- Image creation accepts up to two uploaded visual references (PNG, JPEG, or WebP; 400 KB each). Google image generation receives these as image inputs alongside the prompt.
- Video creation accepts up to two character reference images and one audio voice sample (up to 5 MB). The interface collects a custom voice name, optional voice direction, regional accent, delivery style, and a preferred built-in voice when no sample is supplied.
- Voice and accent directions are included in the video prompt so providers can follow them where supported.
- Users must own the reference assets or have permission to use them, especially voice recordings.

## Provider compatibility
The generic configured video-provider adapter forwards character reference images, voice sample, regional accent, delivery style, and voice selection as fields. The configured provider must explicitly support those fields for them to affect generation.

The built-in Google Veo adapter supports short-clip generation and visual reference images in this implementation, but does not accept custom voice-reference audio; it returns a clear error if an audio sample is supplied rather than silently ignoring it. A configured `NEXORA_VIDEO_API_URL` provider receives the custom voice name, audio sample, regional accent, and delivery fields, but must explicitly implement voice-reference or voice-cloning support for those fields to affect the generated audio. Regional accent and delivery are also sent as prompt directions, but exact reproduction is model-dependent.

The OpenAI image adapter currently does not accept reference images through this code path; when reference images are provided without Google image generation configured, it returns a clear compatibility error.

## Privacy and safety
- Keep reference uploads as small as practical; voice samples are limited to 5 MB and are forwarded only to the selected, configured generation provider.
- Use custom voice samples only when the speaker is the user or has given informed permission.
- Do not imply that accent settings guarantee perfect regional authenticity or that a sample will clone a voice unless the provider explicitly supports voice cloning.
- Custom voice controls do not bypass provider restrictions, API quotas, consent requirements, or model capabilities.
- Future work: encrypted temporary upload storage, retention controls, explicit provider capability discovery, and in-product deletion of uploaded reference files.
