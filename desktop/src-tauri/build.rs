fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["save_backup", "claude_show", "claude_place", "claude_hide", "claude_close"])),
    )
    .expect("failed to run tauri-build");
}
