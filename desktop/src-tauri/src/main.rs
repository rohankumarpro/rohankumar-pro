// rohankumar.pro in its own window, with no browser or Windows title bar.
// The site sees window.__TAURI__ and draws its own minimise, maximise and close buttons in its top bar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use tauri::webview::NewWindowResponse;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
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
        .invoke_handler(tauri::generate_handler![save_backup])
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
