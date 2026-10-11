# Nexora Character References, Custom Voices, and Regional Delivery

## User-facing capabilities
- Image creation accepts up to two uploaded visual references (PNG, JPEG, or WebP; 400 KB each). Google image generation receives these as image inputs alongside the prompt.
- Video creation accepts up to two character reference images and one audio voice sample (300 KB). The interface also collects regional accent, delivery style, and a preferred built-in voice.
- Voice and accent directions are included in the video prompt so providers can follow them where supported.
- Users must own the reference assets or have permission to use them, especially voice recordings.

## Provider compatibility
The generic configured video-provider adapter forwards character reference images, voice sample, regional accent, delivery style, and voice selection as fields. The configured provider must explicitly support those fields for them to affect generation.

The built-in Google Veo adapter currently supports prompt-only short-clip generation in this implementation. It returns a clear error when character images or a custom voice recording are supplied, rather than silently ignoring them. Regional accent and delivery are sent as prompt directions, but exact reproduction is model-dependent.

The OpenAI image adapter currently does not accept reference images through this code path; when reference images are provided without Google image generation configured, it returns a clear compatibility error.

## Privacy and safety
- Keep reference uploads small and send them only to the selected, configured generation provider.
- Use custom voice samples only when the speaker is the user or has given informed permission.
- Do not imply that accent settings guarantee perfect regional authenticity or that a sample will clone a voice unless the provider explicitly supports voice cloning.
- Future work: encrypted temporary upload storage, retention controls, explicit provider capability discovery, and in-product deletion of uploaded reference files.
