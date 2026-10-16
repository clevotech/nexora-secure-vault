# Nexora AI — Privacy Notice

_Last updated: 16 October 2026_

This notice describes the main data flows in this repository's web application. Actual processing depends on the deployed configuration and the services you choose to use.

## Account information
Account registration, sign-in, email verification, and password recovery are handled by the configured Supabase Auth project. Nexora sends the email address, password, and (on registration) the display name to that authentication service. Passwords are not written to Nexora's local activity log by this account interface.

## Browser-local information
The web app stores some information in browser storage, including chat history, projects, workflows, Vault archive items, audit events, imported media, and preferences. These records may remain on the device until removed or browser storage is cleared. Browser-local Vault archives and logs are not automatically synchronized across devices.

## Files and encryption
The browser Vault encrypts and decrypts files locally in supported workflows. Encrypted files may be saved to your device and stored in the local browser archive. A file password is needed to decrypt protected files; Nexora cannot guarantee recovery if it is lost. Avoid placing passwords, keys, or plaintext sensitive data into AI prompts or logs.

## AI and connected services
When you use AI, media generation, publishing, forms, or other networked features, the data you submit may be sent to the configured Nexora backend and the external provider required to fulfil the request. Review the relevant provider's privacy terms before sending confidential material. Published websites and connected integrations may expose information according to their own settings.

## Security and choices
Use a unique, strong password, verify your email when prompted, and keep your device and email account secure. You can request password recovery through the account interface. You can remove browser-local records through the app or browser controls, but this does not necessarily delete records held by a backend or an external provider.

## Contact and updates
For questions about data handled by your particular deployment, contact the Nexora service operator. This notice should be reviewed and updated by the operator to reflect the actual deployment, retention periods, applicable law, and any additional data collection before being treated as a complete legal privacy policy.