mod error;
mod model;
mod storage;
mod worker;

use error::{AppError, AppResult};
use model::Workspace;
use storage::{LoadedWorkspace, Store};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use worker::{GenerationRequest, GenerationResult, ProviderHealth, WorkerManager};

struct StorageState {
    store: Result<Store, String>,
}
impl StorageState {
    fn get(&self) -> AppResult<&Store> {
        self.store
            .as_ref()
            .map_err(|message| AppError::new("STORAGE_UNAVAILABLE", message.clone()))
    }
}

#[tauri::command]
async fn load_workspace(state: State<'_, StorageState>) -> AppResult<LoadedWorkspace> {
    let store = state.get()?.clone();
    tauri::async_runtime::spawn_blocking(move || store.load())
        .await
        .map_err(|e| AppError::new("STORAGE_ERROR", e.to_string()))?
}

#[tauri::command]
async fn save_workspace(
    state: State<'_, StorageState>,
    snapshot: Workspace,
    expected_revision: u64,
) -> AppResult<u64> {
    let store = state.get()?.clone();
    tauri::async_runtime::spawn_blocking(move || store.save(snapshot, expected_revision))
        .await
        .map_err(|e| AppError::new("STORAGE_ERROR", e.to_string()))?
}

#[tauri::command]
async fn provider_health(app: AppHandle) -> ProviderHealth {
    worker::health(&app).await
}

#[tauri::command]
async fn generate_images(
    app: AppHandle,
    state: State<'_, WorkerManager>,
    request: GenerationRequest,
) -> AppResult<GenerationResult> {
    state.generate(&app, request).await
}

#[tauri::command]
fn cancel_generation(state: State<'_, WorkerManager>, job_id: String) -> AppResult<bool> {
    state.cancel(&job_id)
}

#[tauri::command]
async fn vectorize_image(app: AppHandle, png_base64: String) -> AppResult<String> {
    worker::vectorize(&app, png_base64).await
}

#[tauri::command]
async fn export_file(
    app: AppHandle,
    suggested_name: String,
    bytes: Vec<u8>,
) -> AppResult<Option<String>> {
    if suggested_name.is_empty()
        || suggested_name.len() > 200
        || suggested_name.contains(['/', '\\', '\0'])
        || suggested_name == "."
        || suggested_name == ".."
    {
        return Err(AppError::invalid("Export name must be a filename"));
    }
    if bytes.is_empty() || bytes.len() > 128 * 1024 * 1024 {
        return Err(AppError::invalid("Export must contain 1 byte to 128 MiB"));
    }
    let extension = std::path::Path::new(&suggested_name)
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !["svg", "png", "zip", "json"].contains(&extension.as_str()) {
        return Err(AppError::invalid("Unsupported export format"));
    }
    let (sender, receiver) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_file_name(&suggested_name)
        .add_filter("Brand assets", &[&extension])
        .save_file(move |path| {
            let _ = sender.send(path);
        });
    let Some(path) = receiver
        .await
        .map_err(|_| AppError::new("DIALOG_CLOSED", "Save dialog was closed"))?
    else {
        return Ok(None);
    };
    let path = path.into_path().map_err(AppError::storage)?;
    let saved = path.to_string_lossy().into_owned();
    tauri::async_runtime::spawn_blocking(move || storage::atomic_write(&path, &bytes))
        .await
        .map_err(|e| AppError::new("EXPORT_FAILED", e.to_string()))??;
    Ok(Some(saved))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let store = app
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())
                .and_then(|path| Store::open(path).map_err(|e| e.message));
            app.manage(StorageState { store });
            app.manage(WorkerManager::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_workspace,
            save_workspace,
            provider_health,
            generate_images,
            cancel_generation,
            vectorize_image,
            export_file
        ])
        .build(tauri::generate_context!())
        .expect("Unable to initialize JavLogos desktop runtime")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                let workers = app.state::<WorkerManager>();
                if workers.has_active_jobs() {
                    api.prevent_exit();
                    workers.cancel_all();
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        while handle.state::<WorkerManager>().has_active_jobs() {
                            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                        }
                        handle.exit(0);
                    });
                }
            }
        });
}
