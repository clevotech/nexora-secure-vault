# Nexora Premium Form Builder — Google Sheets setup

The Form Builder in Nexora exports a standalone HTML form and a Google Apps Script connector. The connector writes submissions into a private Google spreadsheet owned by you; Nexora does not receive or store the sheet credentials.

## Setup

1. In [Google Sheets](https://sheets.google.com), create a new spreadsheet for responses.
2. Copy the spreadsheet ID from its URL: the value between `/d/` and `/edit`.
3. In Nexora, open **Form Builder** and select **Download Sheets connector (.gs)**.
4. Open [Google Apps Script](https://script.google.com), create a project, replace its starter code with the downloaded connector, and replace `PASTE_YOUR_GOOGLE_SHEET_ID_HERE` with the spreadsheet ID.
5. Save the project. Select **Deploy → New deployment → Web app**. Set **Execute as** to your account. For a public form, set access to **Anyone** if your Google Workspace policy allows it, then deploy and approve the requested permissions.
6. Copy the deployed Web app URL ending in `/exec` into the Google Apps Script Web app URL field in Nexora.
7. Add the questions, preview the form, and export its HTML. Host the HTML on your website or share it through a trusted hosting service.

## Important security notes

- Keep the spreadsheet itself private; do not share editor access with form respondents.
- A public Web app endpoint can receive spam. The script includes a basic honeypot and bounds on submitted field counts and values, but those controls are not a replacement for CAPTCHA, rate limiting, or authentication where needed.
- Do not collect passwords, payment card data, government identifiers, or other highly sensitive information through an unauthenticated public form.
- The browser submits using a no-CORS request to accommodate Apps Script redirects. It cannot read the endpoint's response, so the generated form says that submission was sent but cannot independently verify that the row was written. Verify the first test submission in your spreadsheet.
- Google Apps Script deployments and permissions must be approved in your own Google account. Nexora cannot deploy to your Google account on your behalf.
