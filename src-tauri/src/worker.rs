use crate::generation_progress::{
    drain_diagnostics, GenerationPhase, GenerationProgress, ProgressHandle,
};
use crate::{
    error::{AppError, AppResult},
    model::identifier,
    storage::decode_png,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    process::Stdio,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{AppHandle, Manager};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    process::{Child, Command},
    sync::{watch, Semaphore},
};

pub struct WorkerManager {
    jobs: Arc<Mutex<HashMap<String, watch::Sender<bool>>>>,
    generation_slot: Semaphore,
    progress: Arc<Mutex<Option<GenerationProgress>>>,
}

impl Default for WorkerManager {
    fn default() -> Self {
        Self {
            jobs: Arc::default(),
            generation_slot: Semaphore::new(1),
            progress: Arc::default(),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerationRequest {
    pub job_id: String,
    pub prompt: String,
    pub seed: u64,
    pub count: u32,
    pub width: u32,
    pub height: u32,
    pub reference_base64: Option<String>,
}

impl GenerationRequest {
    fn validate(&self) -> AppResult<()> {
        identifier(&self.job_id)?;
        if self.prompt.trim().is_empty()
            || self.prompt.chars().count() > 6000
            || self.prompt.contains('\0')
            || !(1..=4).contains(&self.count)
            || !(256..=1024).contains(&self.width)
            || !(256..=1024).contains(&self.height)
            || !self.width.is_multiple_of(64)
            || !self.height.is_multiple_of(64)
            || self.seed > u32::MAX as u64 - 4
        {
            return Err(AppError::invalid("Generation requires a prompt up to 6000 characters, 1–4 images, a seed up to 4294967291 and dimensions 256–1024 in multiples of 64"));
        }
        if let Some(reference) = &self.reference_base64 {
            decode_png(reference)?;
        }
        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GeneratedImage {
    pub png_base64: String,
    pub seed: u64,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GenerationResult {
    pub images: Vec<GeneratedImage>,
    pub provider: String,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderHealth {
    pub available: bool,
    pub provider: String,
    pub message: String,
}

struct JobRegistration {
    id: String,
    jobs: Arc<Mutex<HashMap<String, watch::Sender<bool>>>>,
}
impl Drop for JobRegistration {
    fn drop(&mut self) {
        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.remove(&self.id);
        }
    }
}

impl WorkerManager {
    pub async fn generate(
        &self,
        app: &AppHandle,
        request: GenerationRequest,
    ) -> AppResult<GenerationResult> {
        request.validate()?;
        let _permit = self
            .generation_slot
            .try_acquire()
            .map_err(|_| AppError::new("GENERATION_BUSY", "A generation is already running"))?;
        let (sender, receiver) = watch::channel(false);
        {
            let mut jobs = self
                .jobs
                .lock()
                .map_err(|_| AppError::new("INTERNAL_ERROR", "Job registry unavailable"))?;
            if jobs.contains_key(&request.job_id) {
                return Err(AppError::new(
                    "DUPLICATE_JOB",
                    "Job identifier is already active",
                ));
            }
            jobs.insert(request.job_id.clone(), sender);
        }
        let _registration = JobRegistration {
            id: request.job_id.clone(),
            jobs: self.jobs.clone(),
        };
        let progress =
            ProgressHandle::start(request.job_id.clone(), request.count, self.progress.clone())?;
        let payload = json!({"jobId":request.job_id,"prompt":request.prompt,"seed":request.seed,"count":request.count,"width":request.width,"height":request.height,"referenceBase64":request.reference_base64});
        let outcome: AppResult<GenerationResult> = async {
            let result = run(
                app,
                "generate",
                payload,
                Duration::from_secs(900),
                receiver,
                Some(progress.clone()),
            )
            .await?;
            let result: GenerationResult = serde_json::from_value(result).map_err(|e| {
                AppError::new(
                    "WORKER_PROTOCOL",
                    format!("Invalid generation response: {e}"),
                )
            })?;
            if result.images.len() != request.count as usize || result.provider.len() > 200 {
                return Err(AppError::new(
                    "WORKER_PROTOCOL",
                    "Worker returned an unexpected image count or provider",
                ));
            }
            for image in &result.images {
                decode_png(&image.png_base64)?;
                if image.seed > 9_007_199_254_740_991 {
                    return Err(AppError::new(
                        "WORKER_PROTOCOL",
                        "Worker seed exceeds safe numeric range",
                    ));
                }
            }
            Ok(result)
        }
        .await;
        match &outcome {
            Ok(_) => progress.phase(
                GenerationPhase::Completed,
                "Generation finished; images returned to the studio",
            ),
            Err(error) => progress.phase(
                if error.code == "CANCELLED" {
                    GenerationPhase::Cancelled
                } else {
                    GenerationPhase::Failed
                },
                &error.message,
            ),
        }
        outcome
    }

    pub fn progress(&self, job_id: &str) -> AppResult<Option<GenerationProgress>> {
        identifier(job_id)?;
        let slot = self
            .progress
            .lock()
            .map_err(|_| AppError::new("INTERNAL_ERROR", "Progress registry unavailable"))?;
        Ok(slot
            .as_ref()
            .filter(|progress| progress.job_id == job_id)
            .cloned())
    }

    pub fn cancel(&self, job_id: &str) -> AppResult<bool> {
        identifier(job_id)?;
        let jobs = self
            .jobs
            .lock()
            .map_err(|_| AppError::new("INTERNAL_ERROR", "Job registry unavailable"))?;
        Ok(jobs
            .get(job_id)
            .is_some_and(|sender| sender.send(true).is_ok()))
    }

    pub fn cancel_all(&self) {
        if let Ok(jobs) = self.jobs.lock() {
            for sender in jobs.values() {
                let _ = sender.send(true);
            }
        }
    }

    pub fn has_active_jobs(&self) -> bool {
        self.jobs
            .lock()
            .map(|jobs| !jobs.is_empty())
            .unwrap_or(false)
    }
}

pub async fn health(app: &AppHandle) -> ProviderHealth {
    let (_sender, receiver) = watch::channel(false);
    let result = run(
        app,
        "health",
        json!({}),
        Duration::from_secs(20),
        receiver,
        None,
    )
    .await
    .and_then(|value| {
        serde_json::from_value::<ProviderHealth>(value)
            .map_err(|error| AppError::new("WORKER_PROTOCOL", error.to_string()))
    });
    match result {
        Ok(health) => health,
        Err(error) => ProviderHealth {
            available: false,
            provider: "local".into(),
            message: error.message,
        },
    }
}

pub async fn vectorize(app: &AppHandle, png_base64: String) -> AppResult<String> {
    decode_png(&png_base64)?;
    let (_sender, receiver) = watch::channel(false);
    let result = run(
        app,
        "vectorize",
        json!({"pngBase64":png_base64}),
        Duration::from_secs(60),
        receiver,
        None,
    )
    .await?;
    let svg = result.as_str().ok_or_else(|| {
        AppError::new("WORKER_PROTOCOL", "Vectorizer did not return an SVG string")
    })?;
    if svg.len() > 8 * 1024 * 1024 || !svg.trim_start().starts_with('<') {
        return Err(AppError::new(
            "WORKER_PROTOCOL",
            "Vectorizer returned an invalid or oversized SVG",
        ));
    }
    // This is opaque text. The renderer must apply its SVG allowlist before use.
    Ok(svg.to_owned())
}

fn paths(app: &AppHandle) -> AppResult<(PathBuf, PathBuf)> {
    let development = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("manifest parent")
        .join("workers");
    let packaged = app
        .path()
        .resource_dir()
        .map_err(AppError::storage)?
        .join("workers");
    let worker_root = if cfg!(debug_assertions) && development.join("worker.py").is_file() {
        development
    } else {
        packaged
    };
    let script = worker_root.join("worker.py");
    if !script.is_file() {
        return Err(AppError::new(
            "WORKER_NOT_INSTALLED",
            "AI worker is missing from application resources",
        ));
    }
    let local_python = if cfg!(windows) {
        worker_root.join(".venv/Scripts/python.exe")
    } else {
        worker_root.join(".venv/bin/python")
    };
    let managed_python =
        app.path()
            .app_data_dir()
            .map_err(AppError::storage)?
            .join(if cfg!(windows) {
                "runtime/.venv/Scripts/python.exe"
            } else {
                "runtime/.venv/bin/python"
            });
    let python = if let Some(path) = std::env::var_os("JAVLOGOS_PYTHON") {
        PathBuf::from(path)
    } else if cfg!(debug_assertions) && local_python.is_file() {
        local_python
    } else if managed_python.is_file() {
        managed_python
    } else {
        return Err(AppError::new("PYTHON_NOT_CONFIGURED", "Configure JAVLOGOS_PYTHON or install the isolated Python runtime; geometric concepts remain available offline"));
    };
    if !python.is_absolute() || !python.is_file() {
        return Err(AppError::new(
            "PYTHON_NOT_CONFIGURED",
            "JAVLOGOS_PYTHON must name an existing absolute executable path",
        ));
    }
    Ok((python, script))
}

async fn read_bounded(reader: impl AsyncRead + Unpin, limit: usize) -> AppResult<Vec<u8>> {
    let mut bytes = Vec::new();
    reader
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .await
        .map_err(|e| AppError::new("WORKER_IO", e.to_string()))?;
    if bytes.len() > limit {
        return Err(AppError::new(
            "WORKER_OUTPUT_LIMIT",
            "AI worker output exceeded the safety limit",
        ));
    }
    Ok(bytes)
}

async fn terminate(child: &mut Child, process_id: Option<u32>) {
    #[cfg(unix)]
    if let Some(pid) = process_id {
        // Every worker is spawned into its own process group. No user-provided PID is accepted.
        unsafe {
            libc::kill(-(pid as i32), libc::SIGTERM);
        }
        let deadline = tokio::time::Instant::now() + Duration::from_secs(12);
        while tokio::time::Instant::now() < deadline {
            let _ = child.try_wait();
            if unsafe { libc::kill(-(pid as i32), 0) } != 0 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        unsafe {
            libc::kill(-(pid as i32), libc::SIGKILL);
        }
    }
    #[cfg(windows)]
    if let Some(pid) = process_id {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output()
            .await;
    }
    let _ = child.kill().await;
    let _ = child.wait().await;
}

async fn run(
    app: &AppHandle,
    command: &str,
    payload: Value,
    timeout: Duration,
    cancellation: watch::Receiver<bool>,
    progress: Option<ProgressHandle>,
) -> AppResult<Value> {
    let (python, script) = paths(app)?;
    execute(
        &python,
        &script,
        command,
        payload,
        timeout,
        cancellation,
        progress,
    )
    .await
}

async fn execute(
    python: &Path,
    script: &Path,
    command: &str,
    payload: Value,
    timeout: Duration,
    mut cancellation: watch::Receiver<bool>,
    progress: Option<ProgressHandle>,
) -> AppResult<Value> {
    let mut process = Command::new(python);
    process
        .arg(script)
        .arg(command)
        .current_dir(script.parent().expect("script parent"))
        .env("PYTHONUNBUFFERED", "1")
        .env("PYTHONDONTWRITEBYTECODE", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        process.as_std_mut().process_group(0);
    }
    let mut child = process
        .spawn()
        .map_err(|e| AppError::new("WORKER_START_FAILED", e.to_string()))?;
    let process_id = child.id();
    let mut input = child
        .stdin
        .take()
        .ok_or_else(|| AppError::new("WORKER_IO", "Worker stdin is unavailable"))?;
    let output = child
        .stdout
        .take()
        .ok_or_else(|| AppError::new("WORKER_IO", "Worker stdout is unavailable"))?;
    let diagnostic = child
        .stderr
        .take()
        .ok_or_else(|| AppError::new("WORKER_IO", "Worker stderr is unavailable"))?;
    let encoded =
        serde_json::to_vec(&payload).map_err(|e| AppError::new("WORKER_IO", e.to_string()))?;
    let result = {
        let execution = async {
            let write = async {
                input
                    .write_all(&encoded)
                    .await
                    .map_err(|e| AppError::new("WORKER_IO", e.to_string()))?;
                input
                    .shutdown()
                    .await
                    .map_err(|e| AppError::new("WORKER_IO", e.to_string()))?;
                drop(input);
                Ok(())
            };
            let wait = async {
                child
                    .wait()
                    .await
                    .map_err(|e| AppError::new("WORKER_IO", e.to_string()))
            };
            let ((), status, stdout, stderr) = tokio::try_join!(
                write,
                wait,
                read_bounded(output, 96 * 1024 * 1024),
                drain_diagnostics(diagnostic, progress)
            )?;
            Ok((status, stdout, stderr))
        };
        tokio::select! {
            result = execution => result,
            _ = tokio::time::sleep(timeout) => Err(AppError::new("WORKER_TIMEOUT", "AI worker exceeded its time limit; retry with fewer images or a smaller size")),
            _ = async {
                loop {
                    if *cancellation.borrow() { break; }
                    if cancellation.changed().await.is_err() { std::future::pending::<()>().await; }
                }
            } => Err(AppError::new("CANCELLED", "Generation cancelled")),
        }
    };
    let (status, stdout, stderr) = match result {
        Ok(value) => value,
        Err(error) => {
            terminate(&mut child, process_id).await;
            return Err(error);
        }
    };
    let parsed: Value = serde_json::from_slice(&stdout).map_err(|_| {
        AppError::new(
            "WORKER_PROTOCOL",
            format!(
                "AI worker returned invalid JSON. {}",
                String::from_utf8_lossy(&stderr)
                    .chars()
                    .take(2000)
                    .collect::<String>()
            ),
        )
    })?;
    if !status.success() || parsed.get("error").is_some() {
        let message = parsed
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("AI worker failed");
        return Err(AppError::new(
            "WORKER_FAILED",
            message.chars().take(2000).collect::<String>(),
        ));
    }
    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn valid_request() -> GenerationRequest {
        GenerationRequest {
            job_id: "test-job".into(),
            prompt: "abstract logo".into(),
            seed: 42,
            count: 2,
            width: 512,
            height: 512,
            reference_base64: None,
        }
    }
    #[test]
    fn rejects_unbounded_generation_and_path_identifiers() {
        let mut request = valid_request();
        assert!(request.validate().is_ok());
        request.count = 100;
        assert!(request.validate().is_err());
        request = valid_request();
        request.job_id = "../../other".into();
        assert!(request.validate().is_err());
        request = valid_request();
        request.width = 513;
        assert!(request.validate().is_err());
        request = valid_request();
        request.reference_base64 = Some("not an image".into());
        assert!(request.validate().is_err());
    }
    #[test]
    fn cancellation_is_scoped_to_matching_job() {
        let manager = WorkerManager::default();
        let (sender, receiver) = watch::channel(false);
        manager.jobs.lock().unwrap().insert("job-a".into(), sender);
        assert!(!manager.cancel("job-b").unwrap());
        assert!(!*receiver.borrow());
        assert!(manager.cancel("job-a").unwrap());
        assert!(*receiver.borrow());
    }
    #[test]
    fn progress_query_only_returns_the_owned_latest_job() {
        let manager = WorkerManager::default();
        let handle =
            ProgressHandle::start("owned-job".into(), 2, manager.progress.clone()).unwrap();
        assert!(manager.progress("different-job").unwrap().is_none());
        handle.phase(GenerationPhase::Completed, "Complete");
        assert_eq!(
            manager.progress("owned-job").unwrap().unwrap().phase,
            GenerationPhase::Completed
        );
    }
    #[tokio::test]
    async fn output_limit_is_enforced() {
        assert!(read_bounded(&b"12345"[..], 4).await.is_err());
        assert_eq!(read_bounded(&b"1234"[..], 4).await.unwrap(), b"1234");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn subprocess_receives_eof_and_returns_json() {
        let dir = tempfile::tempdir().unwrap();
        let script = dir.path().join("worker.py");
        std::fs::write(&script, "import json,sys\nrequest=json.load(sys.stdin)\nprint(json.dumps({'received':request['value']}))\n").unwrap();
        let (_sender, receiver) = watch::channel(false);
        let result = execute(
            Path::new("/usr/bin/python3"),
            &script,
            "health",
            json!({"value":42}),
            Duration::from_secs(5),
            receiver,
            None,
        )
        .await
        .unwrap();
        assert_eq!(result["received"], 42);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn subprocess_timeout_and_cancellation_terminate_owned_worker() {
        let dir = tempfile::tempdir().unwrap();
        let script = dir.path().join("worker.py");
        std::fs::write(
            &script,
            "import json,sys,time\njson.load(sys.stdin)\ntime.sleep(20)\n",
        )
        .unwrap();
        let (_sender, receiver) = watch::channel(false);
        let result = execute(
            Path::new("/usr/bin/python3"),
            &script,
            "generate",
            json!({}),
            Duration::from_millis(100),
            receiver,
            None,
        )
        .await;
        assert_eq!(result.unwrap_err().code, "WORKER_TIMEOUT");
        let (sender, receiver) = watch::channel(false);
        sender.send(true).unwrap();
        let result = execute(
            Path::new("/usr/bin/python3"),
            &script,
            "generate",
            json!({}),
            Duration::from_secs(10),
            receiver,
            None,
        )
        .await;
        assert_eq!(result.unwrap_err().code, "CANCELLED");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn timeout_kills_descendant_after_worker_parent_exits() {
        let dir = tempfile::tempdir().unwrap();
        let script = dir.path().join("worker.py");
        let marker = dir.path().join("child.pid");
        std::fs::write(&script,"import json,sys,subprocess\nfrom pathlib import Path\nrequest=json.load(sys.stdin)\nchild=subprocess.Popen([sys.executable,'-c','import time; time.sleep(30)'])\nPath(request['marker']).write_text(str(child.pid))\nprint('{}',flush=True)\n").unwrap();
        let (_sender, receiver) = watch::channel(false);
        let result = execute(
            Path::new("/usr/bin/python3"),
            &script,
            "generate",
            json!({"marker":marker}),
            Duration::from_millis(500),
            receiver,
            None,
        )
        .await;
        assert_eq!(result.unwrap_err().code, "WORKER_TIMEOUT");
        let pid: i32 = std::fs::read_to_string(marker).unwrap().parse().unwrap();
        assert_ne!(
            unsafe { libc::kill(pid, 0) },
            0,
            "owned inference descendant survived timeout"
        );
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn termination_allows_worker_to_finish_bounded_cleanup() {
        let dir = tempfile::tempdir().unwrap();
        let script = dir.path().join("worker.py");
        let marker = dir.path().join("cleanup.done");
        std::fs::write(&script,"import json,sys,time,signal\nfrom pathlib import Path\nrequest=json.load(sys.stdin)\ndef cleanup(*args):\n time.sleep(0.6)\n Path(request['marker']).write_text('clean')\n sys.exit(0)\nsignal.signal(signal.SIGTERM,cleanup)\ntime.sleep(30)\n").unwrap();
        let (_sender, receiver) = watch::channel(false);
        let result = execute(
            Path::new("/usr/bin/python3"),
            &script,
            "generate",
            json!({"marker":marker}),
            Duration::from_millis(500),
            receiver,
            None,
        )
        .await;
        assert_eq!(result.unwrap_err().code, "WORKER_TIMEOUT");
        assert_eq!(std::fs::read_to_string(marker).unwrap(), "clean");
    }
}
