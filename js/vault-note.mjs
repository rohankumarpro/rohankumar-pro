// A rich note inside the encrypted vault: the same block editor, but nothing is saved until you press Save,
// and what is saved is encrypted by the vault code before it leaves the browser.
import { h, $, esc, makeEditor } from "/js/lib.mjs";
import { blocksText } from "/shared/blocks.mjs";

export async function noteEditor(host, note, { onSave, onCancel }) {
  host.innerHTML = `<div class="vn"><input class="vn-t" placeholder="Title" maxlength="80" aria-label="Title" value="${esc((note && note.t) || "")}"><div class="vn-b"></div><p class="dc-sub vn-w" role="alert"></p><div class="ed-ctl"><button class="vn-save">Save to vault</button><button class="vn-cancel">Cancel</button></div></div>`;
  const ed = await makeEditor($(".vn-b", host), {
    blocks: note && note.b && note.b.length ? note.b : note && note.x ? [{ t: "p", h: esc(note.x).replace(/\n/g, "<br>") }] : [{ t: "p", h: "" }],
    placeholder: "Write something private. Type “/” for lists, headings and more",
  });
  let warned = "";
  $(".vn-save", host).onclick = async () => {
    const b = ed.flush(), t = $(".vn-t", host).value.trim(), x = blocksText(b).slice(0, 4000);
    if (!t && !x) return;
    const hit = window.vkSensitive ? vkSensitive(t + " " + x) : "";
    if (hit && warned !== t + x) { warned = t + x; $(".vn-w", host).textContent = `This looks like ${hit}. Press Save again only if you really want it in the vault.`; return; }
    ed.destroy(); await onSave({ t: t || "Untitled", x, b });
  };
  $(".vn-cancel", host).onclick = () => { ed.destroy(); onCancel(); };
  setTimeout(() => $(".vn-t", host).focus(), 30);
}
