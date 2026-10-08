// Tasks: your Tasks database (from the Workspace) in a window of its own. Owner only.
import { h, isAdmin } from "/js/lib.mjs";
import { R } from "/js/os-ext.mjs";
import { WS } from "/js/ws-core.mjs";
import { mountDatabase } from "/js/ws-db.mjs";

export async function tasksApp(body) {
  if (!isAdmin()) { body.innerHTML = '<p class="hint" style="padding:24px">Tasks are private. Sign in as the owner.</p>'; return; }
  body.classList.add("tk-body");
  body.innerHTML = '<div class="tk"><div class="wd-load"><span class="rb-spin"></span></div></div>';
  const d = await WS.ensure("tasks");
  const host = body.querySelector(".tk");
  if (!d) { host.innerHTML = '<p class="hint">Could not open your tasks. Check your connection and try again.</p>'; return; }
  let db = mountDatabase(host, { id: d.id, compact: true, view: { type: "todo", name: "To-do" }, openRow: (rowId) => { window.openApp("boards"); setTimeout(() => R.apply(`/boards/db/${d.id}/${rowId}`), 60); } });
  body.__flush = async () => { db && db.destroy(); db = null; };
  R.handlers.tasks = () => {};
}
