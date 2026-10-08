// Settings → Sync: the Google accounts the Planner reads (Calendar and Gmail). Owner only.
import { h, esc, api, toast, confirmBox } from "/js/lib.mjs";
import { icon } from "/shared/icons.mjs";
const I = (n, s = 16) => icon(n, { size: s });

export async function accountsPanel(box) {
  if (!box) return;
  box.innerHTML = '<p class="hint">Checking…</p>';
  const [r, gp] = await Promise.all([api("/api/gauth"), api("/api/gdata")]);
  // Settings may have been drawn again while this was loading: use the box that is on screen now
  if (!box.isConnected) { box = document.querySelector(".ga-box"); if (!box) return; }
  if (!r.ok) { box.innerHTML = '<p class="hint">Could not check the Google accounts. Try again shortly.</p>'; return; }
  const d = r.data, p = gp.ok ? gp.data.prefs || {} : {};
  const setup = `<details class="ga-setup"${d.oauth ? "" : " open"}><summary>${d.oauth ? "How the Google connection is set up" : "One-time setup (about 5 minutes)"}</summary>
    <ol class="gs-steps">
      <li>In <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noopener">Google Cloud</a> (the same project as the Docs sync is fine), turn on <b>Google Calendar API</b> and <b>Gmail API</b>.</li>
      <li><b>APIs &amp; Services → OAuth consent screen</b>: choose <b>External</b>, fill in the app name and your email, and add the scopes <code>…/auth/calendar</code> and <code>…/auth/gmail.readonly</code>. Then press <b>Publish app</b> so it is <b>In production</b> (in “Testing”, Google signs you out every 7 days). You don't need Google's review for an app only you use.</li>
      <li><b>Credentials → Create credentials → OAuth client ID</b>, type <b>Web application</b>. Under <b>Authorised redirect URIs</b> add exactly: <code>${esc(d.redirect)}</code></li>
      <li>In Netlify, <b>Site configuration → Environment variables</b>, add <code>GOOGLE_OAUTH_CLIENT_ID</code> and <code>GOOGLE_OAUTH_CLIENT_SECRET</code> from that client, then redeploy.</li>
      <li>Come back here and press <b>Connect a Google account</b>. Google will say it hasn't verified the app: choose <b>Advanced → Go to (your app)</b>. That warning is about your own app, which is expected.</li>
    </ol>
    <p class="hint">Your Workspace address can also be used through the Docs sync setup: add <code>https://www.googleapis.com/auth/calendar</code> and <code>https://www.googleapis.com/auth/gmail.readonly</code> to its domain-wide delegation in Google Admin.</p></details>`;
  box.innerHTML = `<p class="hint">Your calendars and important email show in the Planner, and new events you make there go to Google Calendar. Connect as many accounts as you like. The logins are encrypted on the server and never shown to visitors.</p>
    ${d.preview ? '<p class="gs-err">This is a preview address. Accounts can only be connected, and Google only read, on the live site.</p>' : ""}
    <div class="ga-list">${d.accounts.map((a) => `<div class="ga-acc" data-id="${a.id}"><span class="ga-dot" style="background:${esc(a.color || "#1A73E8")}"></span><div class="ga-who"><b>${esc(a.email)}</b><small>${a.kind === "sa" ? "Workspace (through the Docs sync setup)" : "Connected " + new Date(a.added).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}</small><div class="ga-res"></div></div>
      <label class="ow-app"><input type="checkbox" data-k="cal" ${a.cal ? "checked" : ""}><span>Calendar</span></label><label class="ow-app"><input type="checkbox" data-k="mail" ${a.mail ? "checked" : ""}><span>Gmail</span></label>
      <button class="btn tonal sm" data-a="test">Test</button><button class="btn tonal sm" data-a="rm">${a.kind === "sa" ? "Switch off" : "Disconnect"}</button></div>`).join("") || '<p class="hint">No Google account connected yet.</p>'}</div>
    <div class="ow-row"><a class="btn${d.oauth && !d.preview ? "" : " tonal"}" href="/api/gauth?a=start"${d.oauth && !d.preview ? "" : ' aria-disabled="true"'}>${I("plus", 16)} Connect a Google account</a></div>
    <h4 class="ga-h">Important email</h4>
    <p class="hint">The digest shows email Gmail marks important or you starred, from the last <input class="ga-days" type="number" min="1" max="30" value="${+p.days || 7}" aria-label="Days"> days. People below always count as important:</p>
    <textarea class="ga-vip" rows="2" placeholder="name@company.com, another@client.com">${esc((p.vip || []).join(", "))}</textarea>
    <div class="ow-row"><button class="btn tonal" data-a="prefs">Save</button></div>
    ${setup}`;
  box.querySelectorAll(".ga-acc").forEach((row) => {
    const id = row.dataset.id;
    row.querySelectorAll("[data-k]").forEach((c) => (c.onchange = async () => { const x = await api("/api/gauth?id=" + id, { method: "PUT", body: { [c.dataset.k]: c.checked } }); toast(x.ok ? "Saved" : "Could not save"); }));
    row.querySelector('[data-a="test"]').onclick = async (e) => {
      const b = e.currentTarget, res = row.querySelector(".ga-res"); b.disabled = true; res.innerHTML = '<span class="hint">Testing…</span>';
      const x = await api("/api/gauth?a=test&id=" + id, { method: "POST" }); b.disabled = false;
      if (!x.ok) { res.innerHTML = `<p class="gs-err">${esc(x.data.error || "Could not test")}</p>`; return; }
      const line = (name, v, extra) => v === true ? `<p class="ga-ok">${I("check", 14)} ${name} works${extra ? " · " + extra : ""}</p>` : `<p class="gs-err"><b>${name}:</b> ${esc(v)}</p>`;
      res.innerHTML = line("Calendar", x.data.cal, x.data.cals != null ? `${x.data.cals} calendars` : "") + line("Gmail", x.data.mail, x.data.messages != null ? `${Number(x.data.messages).toLocaleString()} emails` : "");
    };
    row.querySelector('[data-a="rm"]').onclick = async () => { if (!(await confirmBox("Disconnect this Google account? The Planner stops showing its calendars and email. Nothing in Google is changed.", "Disconnect"))) return; const x = await api("/api/gauth?id=" + id, { method: "DELETE" }); toast(x.ok ? "Disconnected" : "Could not disconnect"); accountsPanel(box); };
  });
  box.querySelector('[data-a="prefs"]').onclick = async () => { const vip = box.querySelector(".ga-vip").value.split(/[\s,;]+/).filter(Boolean), days = +box.querySelector(".ga-days").value || 7; const x = await api("/api/gdata?a=prefs", { method: "PUT", body: { vip, days } }); toast(x.ok ? "Saved" : "Could not save"); };
  box.querySelector('a[aria-disabled="true"]')?.addEventListener("click", (e) => { e.preventDefault(); toast(d.preview ? "Connect accounts on the live site" : "Finish the one-time setup below first"); });
}

// back from Google: say how it went
export function cameBack() {
  const q = new URLSearchParams(location.search), g = q.get("google"); if (!g) return;
  const msg = { connected: `Connected ${q.get("email") || "your Google account"}`, cancelled: "Google sign-in was cancelled", failed: "Google sign-in didn't work. Try again.", expired: "That sign-in took too long. Try again.", norefresh: "Google didn't send a lasting login. Remove the app at myaccount.google.com/permissions and connect again.", setup: "Finish the one-time setup in Settings → Sync first", preview: "Connect accounts on the live site", signin: "Sign in as the owner first" }[g];
  if (msg && window.toast) setTimeout(() => window.toast(msg, 5000), 900);
  try { history.replaceState(history.state, "", location.pathname); } catch {}
}
