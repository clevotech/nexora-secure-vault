# Visual Asset Sourcing for Nexora Builder

## Goal
For each website or app brief, infer the visual direction and recommend suitable hero photography, section images, product imagery, illustrations, icons, and background textures. Offer an asset picker with preview, source, author/provider, license or usage terms, attribution requirements, and an Insert/Replace action.

## Search sources
- Pinterest: use for moodboards, design inspiration, and reference discovery. Link to the original pin/source; do not scrape, hotlink, or assume a pin image is licensed for reuse.
- Unsplash and Pexels: photography search where their current API terms and each asset's license permit the intended use.
- Pixabay: photos, illustrations and vectors subject to its current license.
- Wikimedia Commons: useful public-domain and openly licensed assets; check the individual file's exact license and attribution rules.
- Openverse: discovery for openly licensed media; verify the original source and license before use.
- Icon libraries such as Lucide and approved illustration libraries: use their documented licenses.
- Nexora image generation: create bespoke visuals when suitable reusable assets are unavailable, clearly label generated assets, and avoid imitating living artists or protected brand artwork.

## User experience
1. Infer keywords, audience, niche, color palette, image style, aspect ratios and intended placement from the brief.
2. Show categorized searches (hero, product, team, background, illustration, icons) and let the user adjust keywords and providers.
3. Show thumbnail, title, provider, source link, dimensions, license status, attribution and any API/usage constraints.
4. Let users preview and compare options, insert or replace an asset, crop/position it, and keep an asset manifest for the project.
5. Optimize selected images for the target layout with responsive sizes, modern formats where permitted, lazy loading and descriptive alt text.
6. Before publishing, flag missing attribution, unknown licensing, broken URLs, oversized assets and inaccessible alt text.

## Integration architecture
- Implement provider adapters behind authenticated backend endpoints; never expose provider API keys in browser code.
- Use official provider APIs and comply with each provider's attribution, caching, rate-limit, display and hotlink rules.
- Pinterest should initially be an inspiration/source-link provider unless an approved API integration permits more. Do not scrape Pinterest or download protected content without permission.
- Persist selected asset metadata (provider, original URL, author, license URL/status, attribution, date selected and local project path) with the project.
- Prefer downloading/copying an asset into project storage only when the provider's terms and the specific license allow it. Otherwise embed the provider-approved URL or link out.
- Do not describe an asset as royalty-free or commercially reusable unless its license has been verified.

## Acceptance criteria
- Search results match the project niche and design brief.
- Users can distinguish inspiration from assets cleared for reuse.
- No secrets are present in client bundles.
- Asset provenance and license information survive export and deployment.
- The builder never claims publishing succeeded without provider confirmation.

## Status
This is the target specification, not a claim that these provider integrations are already active. They require provider-specific API access, backend adapters, UI work, and live verification.
