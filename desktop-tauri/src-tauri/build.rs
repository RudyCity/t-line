fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new()
      .app_manifest(
        tauri_build::AppManifest::new()
          .commands(&[
            "quit_app",
            "start_backend_command",
            "get_app_url",
            "open_webview_devtools",
            "eval_webview_js",
            "create_detached_window",
            "close_detached_window",
            "get_memory_usage"
          ])
      )
  )
  .expect("failed to run tauri-build");
}
