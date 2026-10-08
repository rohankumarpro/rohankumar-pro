// rohankumar.pro in its own window, with no browser or Windows title bar.
// The site sees window.__TAURI__ and draws its own minimise, maximise and close buttons in its top bar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::sync::Mutex;
use tauri::webview::NewWindowResponse;
use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_opener::OpenerExt;

const SITE: &str = "https://rohankumar.pro/";

// the app only ever shows the site itself; every other address opens in the normal browser
fn is_site(url: &url::Url) -> bool {
    url.scheme() == "https" && matches!(url.host_str(), Some("rohankumar.pro") | Some("www.rohankumar.pro"))
}

// a copy of the owner's backup (/api/backup, fetched by the site with the owner's login) saved to
// Documents\Rohan Kumar backups, one file per day, the newest 14 kept. Only ever writes into that folder.
#[tauri::command]
fn save_backup(app: tauri::AppHandle, day: String, json: String) -> Result<String, String> {
    let ok = day.len() == 10 && day.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() });
    if !ok || !json.trim_start().starts_with('{') {
        return Err("not a backup".into());
    }
    let dir = app.path().document_dir().map_err(|e| e.to_string())?.join("Rohan Kumar backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join(format!("backup-{day}.json"));
    fs::write(&file, json).map_err(|e| e.to_string())?;
    let mut old: Vec<_> = fs::read_dir(&dir).map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| n.starts_with("backup-") && n.ends_with(".json") && n.len() == 22)
        .collect();
    old.sort();
    while old.len() > 14 {
        let _ = fs::remove_file(dir.join(old.remove(0)));
    }
    Ok(file.to_string_lossy().to_string())
}

/* ---------- Claude inside the desktop (owner's Assistant app) ----------
   claude.ai can't be shown inside a web page, so the app opens it in a borderless window of its own that belongs to
   the main window, and keeps it exactly over the site's Assistant window: the site says where (in page pixels), and
   the app follows whenever either window moves or changes size. The Claude window keeps its own sign-in. */
#[derive(Default)]
struct ClaudeRect(Mutex<Option<(f64, f64, f64, f64)>>);

fn is_claude(url: &url::Url) -> bool {
    url.scheme() == "https"
        && url.host_str().map_or(false, |h| {
            h == "claude.ai" || h.ends_with(".claude.ai") || h == "anthropic.com" || h.ends_with(".anthropic.com") || h.ends_with(".claudeusercontent.com")
        })
}

// put the Claude window where the site's Assistant window shows its contents
fn place_claude(app: &tauri::AppHandle) {
    let (Some(main), Some(claude)) = (app.get_webview_window("main"), app.get_webview_window("claude")) else { return };
    let Some((x, y, w, h)) = *app.state::<ClaudeRect>().0.lock().unwrap() else { return };
    let (Ok(at), Ok(scale)) = (main.inner_position(), main.scale_factor()) else { return };
    let _ = claude.set_position(PhysicalPosition::new(at.x + (x * scale).round() as i32, at.y + (y * scale).round() as i32));
    let _ = claude.set_size(PhysicalSize::new((w * scale).round().max(80.0) as u32, (h * scale).round().max(80.0) as u32));
}

#[tauri::command]
fn claude_show(app: tauri::AppHandle, x: f64, y: f64, w: f64, h: f64, url: Option<String>) -> Result<(), String> {
    *app.state::<ClaudeRect>().0.lock().unwrap() = Some((x, y, w, h));
    let start = url.and_then(|u| u.parse::<url::Url>().ok()).filter(is_claude);
    if let Some(c) = app.get_webview_window("claude") {
        if let Some(u) = start { let _ = c.navigate(u); }
        place_claude(&app);
        c.show().map_err(|e| e.to_string())?;
        return Ok(());
    }
    let main = app.get_webview_window("main").ok_or("no main window")?;
    let nav = app.clone();
    let pop = app.clone();
    let first = start.unwrap_or_else(|| "https://claude.ai/new".parse().unwrap());
    WebviewWindowBuilder::new(&app, "claude", WebviewUrl::External(first))
        .title("Claude")
        .parent(&main).map_err(|e| e.to_string())?
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .shadow(false)
        .visible(false)
        .on_navigation(move |url| {
            if is_claude(url) || url.scheme() == "about" || url.scheme() == "data" || url.scheme() == "blob" {
                return true;
            }
            let _ = nav.opener().open_url(url.as_str(), None::<&str>);
            false
        })
        .on_new_window(move |url, _| {
            let _ = pop.opener().open_url(url.as_str(), None::<&str>);
            NewWindowResponse::Deny
        })
        .build()
        .map_err(|e| e.to_string())?;
    place_claude(&app);
    if let Some(c) = app.get_webview_window("claude") { c.show().map_err(|e| e.to_string())?; }
    Ok(())
}

#[tauri::command]
fn claude_place(app: tauri::AppHandle, x: f64, y: f64, w: f64, h: f64) {
    *app.state::<ClaudeRect>().0.lock().unwrap() = Some((x, y, w, h));
    place_claude(&app);
}

#[tauri::command]
fn claude_hide(app: tauri::AppHandle) {
    if let Some(c) = app.get_webview_window("claude") { let _ = c.hide(); }
}

#[tauri::command]
fn claude_close(app: tauri::AppHandle) {
    *app.state::<ClaudeRect>().0.lock().unwrap() = None;
    if let Some(c) = app.get_webview_window("claude") { let _ = c.close(); }
}

fn main() {
    tauri::Builder::default()
        // a second launch brings the open window forward instead of opening another
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        // reopens at the size and place it was closed
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(ClaudeRect::default())
        .invoke_handler(tauri::generate_handler![save_backup, claude_show, claude_place, claude_hide, claude_close])
        // the Claude window follows the main window when it moves, changes size or goes to another screen
        .on_window_event(|window, event| {
            if window.label() != "main" { return; }
            match event {
                WindowEvent::Moved(_) | WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } => place_claude(window.app_handle()),
                WindowEvent::Destroyed => { if let Some(c) = window.app_handle().get_webview_window("claude") { let _ = c.close(); } }
                _ => {}
            }
        })
        .setup(|app| {
            let nav = app.handle().clone();
            let pop = app.handle().clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(SITE.parse().unwrap()))
                .title("Rohan Kumar")
                .inner_size(1440.0, 900.0)
                .min_inner_size(760.0, 520.0)
                .decorations(false)
                .shadow(true)
                .center()
                .on_navigation(move |url| {
                    if is_site(url) || url.scheme() == "about" || url.scheme() == "data" || url.scheme() == "blob" {
                        return true;
                    }
                    let _ = nav.opener().open_url(url.as_str(), None::<&str>);
                    false
                })
                .on_new_window(move |url, _| {
                    let _ = pop.opener().open_url(url.as_str(), None::<&str>);
                    NewWindowResponse::Deny
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("could not start the app");
}
