# Google Play release checklist

This checklist applies to the Android app currently in this repository: **Nexora Secure Vault**. It does not package the separate full Nexora AI platform or its AI agents, website/app builder, or media-generation tools.

## Build status

- [x] Android target API configured as 36.
- [x] GitHub Actions runs Android unit tests and builds a debug APK.
- [x] Debug APK artifact is uploaded for device testing.
- [ ] Install and test the APK on real Android devices, including file selection, encryption, decryption, wrong-password handling, and large files.
- [ ] Prepare the signed release Android App Bundle (.aab).
- [ ] Complete Play Console store listing, privacy policy, Data safety form, content rating, and app access declarations as applicable.
- [ ] Upload the AAB to an internal testing track, test, then submit for review.

## Build a signed release bundle

The workflow expects these GitHub Actions repository secrets:

- `ANDROID_KEYSTORE_BASE64`: Base64 encoding of the upload keystore file.
- `ANDROID_KEYSTORE_PASSWORD`: Keystore password.
- `ANDROID_KEY_ALIAS`: Alias of the upload key.
- `ANDROID_KEY_PASSWORD`: Upload key password.

Never commit a keystore, passwords, API keys, or other signing secrets into Git. Store a secure offline backup of the upload keystore and its credentials. Do not send the keystore or passwords in chat or upload them to third-party conversion sites.

Once all four secrets are configured, run the **Android Play Store preparation** workflow from the Actions tab. A successful run should upload the `nexora-android-release-aab` artifact. Confirm the workflow log and artifact before treating it as ready for Play Console.

## Google Play Console

1. Create the app in the owner's Play Console account and use the package name `com.clevotech.nexora` only if it is available and is the intended permanent package name.
2. Enroll in Play App Signing and upload the signed AAB.
3. Complete the store listing, app category, contact details, privacy policy, Data safety, content rating, target audience, and any applicable permissions declarations accurately.
4. Test through an internal track before production. Google Play may require a closed-testing period or other account-specific steps.
5. Submit only after the actual app, privacy disclosures, and testing evidence are ready.

## Important product-scope gate

If the intended Play Store product is **Nexora AI** rather than **Nexora Secure Vault**, do not publish this package as the final Nexora AI app. Integrate the actual Nexora AI frontend and backend workflows into an Android-compatible client first, then test those features and update the store listing to match the shipped functionality.
