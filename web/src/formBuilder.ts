export type FormFieldType = "text" | "email" | "tel" | "number" | "date" | "textarea" | "select" | "checkbox";
export type FormField = { id: string; label: string; type: FormFieldType; required: boolean; options: string };

const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
const safeName = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";

function control(field: FormField): string {
  const name = safeName(field.label || field.id);
  const required = field.required ? " required" : "";
  const common = ' name="' + esc(name) + '" id="' + esc(field.id) + '"' + required;
  if (field.type === "textarea") return '<textarea' + common + ' rows="4" placeholder="Your answer"></textarea>';
  if (field.type === "select") {
    const options = (field.options || "Please select,Option 1,Option 2").split(",").map((x) => x.trim()).filter(Boolean);
    return '<select' + common + '><option value="">Choose an option</option>' + options.map((x) => '<option value="' + esc(x) + '">' + esc(x) + "</option>").join("") + "</select>";
  }
  if (field.type === "checkbox") return '<label class="check"><input type="checkbox"' + common + ' value="Yes"> ' + esc(field.label) + "</label>";
  return '<input type="' + field.type + '"' + common + (field.type === "text" ? ' placeholder="Your answer"' : "") + ">";
}

export function buildFormHtml(title: string, fields: FormField[], endpoint: string): string {
  const formTitle = esc(title || "New form");
  const controls = fields.map((field) => '<div class="field">' + (field.type === "checkbox" ? control(field) : '<label for="' + esc(field.id) + '">' + esc(field.label) + (field.required ? ' <span aria-hidden="true">*</span>' : "") + "</label>" + control(field)) + "</div>").join("\n");
  const endpointJson = JSON.stringify(endpoint.trim());
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + formTitle + "</title>\n<style>*{box-sizing:border-box}body{margin:0;padding:28px 14px;background:linear-gradient(135deg,#eef2ff,#fdf2f8 55%,#ecfeff);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#172033}.card{max-width:760px;margin:auto;background:#fff;border:1px solid #e4e7f0;border-radius:24px;padding:clamp(20px,5vw,42px);box-shadow:0 24px 70px #28365b18}h1{margin:0 0 8px;font-size:clamp(1.7rem,5vw,2.5rem);letter-spacing:-.04em}.intro{color:#68738a;margin:0 0 28px}.field{display:grid;gap:8px;margin:18px 0}.field>label{font-weight:650}.field input:not([type=checkbox]),.field textarea,.field select{width:100%;padding:13px 14px;border:1px solid #d4d9e5;border-radius:12px;font:inherit;background:#fff;color:#172033}.field input:focus,.field textarea:focus,.field select:focus{outline:3px solid #a5b4fc88;border-color:#6366f1}.check{display:flex;gap:10px;align-items:center}.submit{width:100%;border:0;border-radius:12px;padding:15px;background:linear-gradient(100deg,#4f46e5,#db2777,#0891b2);color:#fff;font:700 1rem system-ui;cursor:pointer}.submit:disabled{opacity:.6}.status{margin-top:14px;color:#334155}.fine{font-size:.8rem;color:#7c879b;margin-top:20px}</style></head><body><main class="card"><h1>' + formTitle + '</h1><p class="intro">Please complete the form below. Required fields are marked with an asterisk.</p><form id="nexora-form">' + controls + '<button class="submit" type="submit">Submit response</button><p class="status" id="status" role="status" aria-live="polite"></p></form><p class="fine">Your response is sent to the form owner’s configured Google Sheets database.</p></main><script>const endpoint=' + endpointJson + ';document.getElementById("nexora-form").addEventListener("submit",async function(event){event.preventDefault();const form=event.currentTarget;const status=document.getElementById("status");const button=form.querySelector("button[type=submit]");if(!endpoint){status.textContent="This form has not been connected to its Google Sheets endpoint yet.";return;}const values={};new FormData(form).forEach((value,key)=>{values[key]=values[key]===undefined?String(value):values[key]+", "+String(value)});form.querySelectorAll("input[type=checkbox]").forEach(input=>{values[input.name]=input.checked?"Yes":"No"});button.disabled=true;status.textContent="Sending your response…";try{await fetch(endpoint,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify({formTitle:' + JSON.stringify(title || "New form") + ',submittedAt:new Date().toISOString(),values:values,website:document.getElementById("website-check").value})});form.reset();status.textContent="Submission sent. The browser cannot verify the Google Sheets response, so contact the form owner if you need confirmation.";}catch(error){status.textContent="Submission could not be sent. Check your connection or contact the form owner.";}finally{button.disabled=false;}});</script><input id="website-check" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px"></body></html>';
}

export function buildGoogleAppsScript(): string {
  return [
    "// Nexora Form Builder — Google Sheets database endpoint",
    "// 1) Create a Google Sheet. Copy its ID from the URL.",
    "// 2) In Extensions > Apps Script, replace the editor contents with this file.",
    "// 3) Set SPREADSHEET_ID below, save, then Deploy > New deployment > Web app.",
    "// 4) Execute as: Me. Access: Anyone (public forms need public access). Keep the sheet private.",
    "// Security note: a public endpoint can receive spam. Review submissions and add CAPTCHA/authentication for sensitive forms.",
    'const SPREADSHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";',
    'const DEFAULT_SHEET_NAME = "Form Responses";',
    "",
    "function doPost(e) {",
    "  try {",
    "    if (!SPREADSHEET_ID || SPREADSHEET_ID.indexOf('PASTE_') === 0) return json_({ ok: false, error: 'Configure SPREADSHEET_ID first.' });",
    "    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');",
    "    if (body.website) return json_({ ok: true }); // honeypot: silently discard bots",
    "    const title = String(body.formTitle || 'Nexora Form').slice(0, 180);",
    "    const values = body.values && typeof body.values === 'object' ? body.values : null;",
    "    if (!values || Object.keys(values).length > 100) return json_({ ok: false, error: 'Invalid form submission.' });",
    "    const lock = LockService.getScriptLock(); lock.waitLock(10000);",
    "    try {",
    "      const book = SpreadsheetApp.openById(SPREADSHEET_ID);",
    "      let sheet = book.getSheetByName(DEFAULT_SHEET_NAME);",
    "      if (!sheet) sheet = book.insertSheet(DEFAULT_SHEET_NAME);",
    "      const headers = ['Timestamp', 'Form title', 'Submission ID'];",
    "      const keys = Object.keys(values).map(k => String(k).slice(0, 120));",
    "      const existing = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String) : [];",
    "      const allHeaders = headers.concat(keys.filter(k => !headers.includes(k) && !existing.includes(k)));",
    "      if (!existing.length) sheet.getRange(1, 1, 1, allHeaders.length).setValues([allHeaders]);",
    "      else if (allHeaders.length > headers.length) sheet.getRange(1, 1, 1, existing.length + allHeaders.length - headers.length).setValues([existing.concat(allHeaders.slice(headers.length))]);",
    "      const finalHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);",
    "      const safeValues = {};",
    "      Object.keys(values).forEach(k => { const key = String(k).slice(0, 120); let v = String(values[k] == null ? '' : values[k]).slice(0, 5000); if (/^[=+@]/.test(v)) v = "'" + v; safeValues[key] = v; });",
    "      const row = finalHeaders.map(h => h === 'Timestamp' ? new Date() : h === 'Form title' ? title : h === 'Submission ID' ? Utilities.getUuid() : (safeValues[h] || ''));",
    "      sheet.appendRow(row);",
    "      return json_({ ok: true, id: row[2] });",
    "    } finally { lock.releaseLock(); }",
    "  } catch (err) { return json_({ ok: false, error: String(err && err.message || err).slice(0, 300) }); }",
    "}",
    "",
    "function doGet() { return json_({ ok: true, service: 'Nexora Google Sheets Form Database', note: 'Submit POST JSON to store a response.' }); }",
    "function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }",
    ""
  ].join("\n");
}
