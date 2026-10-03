// rohankumar.pro in its own window, with no browser or Windows title bar.
// The site sees window.__TAURI__ and draws its own minimise, maximise and close buttons in its top bar.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::NewWindowResponse;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const SITE: &str = "https://rohankumar.pro/";

// the app only ever shows the site itself; every other address opens in the normal browser
fn is_site(url: &url::Url) -> bool {
    url.scheme() == "https" && matches!(url.host_str(), Some("rohankumar.pro") | Some("www.rohankumar.pro"))
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
