use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
pub async fn check_tauri_update(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;
    if let Some(update) = update {
        Ok(Some(serde_json::json!({
            "version": update.version,
            "body": update.body,
            "date": update.date.map(|d| d.to_string()),
        })))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn install_tauri_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater.check().await.map_err(|e| e.to_string())?;
    if let Some(update) = update {
        update.download_and_install(|_chunk_len, _total_len| {
            // Progress tracker
        }, || {
            // Finished callback
        }).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
