use crate::{
    error::{AppError, AppResult},
    storage::decode_png,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::io::{AsyncRead, AsyncReadExt};
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum GenerationPhase {
    Starting,
    Loading,
    Encoding,
    Sampling,
    Decoding,
    ImageReady,
    Saving,
    Completed,
    Cancelled,
    Failed,
}
impl GenerationPhase {
    fn terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Cancelled | Self::Failed)
    }
}
#[derive(Clone, Debug, Serialize)]
pub struct GenerationLog {
    pub at: u64,
    pub message: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationProgress {
    pub job_id: String,
    pub phase: GenerationPhase,
    pub message: String,
    pub image_index: u32,
    pub image_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps: Option<u32>,
    pub updated_at: u64,
    pub logs: Vec<GenerationLog>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_base64: Option<String>,
    #[serde(skip)]
    sampling_active: bool,
}
#[derive(Clone)]
pub(crate) struct ProgressHandle {
    job_id: String,
    slot: Arc<Mutex<Option<GenerationProgress>>>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProgressEvent {
    phase: GenerationPhase,
    message: String,
    image_index: Option<u32>,
    image_count: Option<u32>,
    step: Option<u32>,
    steps: Option<u32>,
    preview_base64: Option<String>,
}
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u64::MAX as u128) as u64
}
fn clean_log(value: &str) -> String {
    let mut plain = String::new();
    let mut escape = false;
    for character in value.chars() {
        if character == '\x1b' {
            escape = true;
            continue;
        }
        if escape {
            if character.is_ascii_alphabetic() {
                escape = false;
            }
            continue;
        }
        if !character.is_control() || character == '\t' {
            plain.push(character);
        }
    }
    if plain.to_lowercase().contains("prompt:") {
        return "[Prompt details omitted]".into();
    }
    plain
        .split_whitespace()
        .map(|word| {
            let path = word.trim_start_matches(['\'', '"', '(']);
            if path.starts_with('/') || path.as_bytes().get(1) == Some(&b':') && path.contains('\\')
            {
                "[local path]"
            } else {
                word
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(500)
        .collect()
}
fn fraction(value: &str) -> Option<(u32, u32)> {
    value.split_whitespace().find_map(|part| {
        let (left, right) = part.trim_matches('|').split_once('/')?;
        Some((left.parse().ok()?, right.parse().ok()?))
    })
}
impl ProgressHandle {
    pub(crate) fn start(
        job_id: String,
        image_count: u32,
        slot: Arc<Mutex<Option<GenerationProgress>>>,
    ) -> AppResult<Self> {
        *slot
            .lock()
            .map_err(|_| AppError::new("INTERNAL_ERROR", "Progress registry unavailable"))? =
            Some(GenerationProgress {
                job_id: job_id.clone(),
                phase: GenerationPhase::Starting,
                message: "Starting isolated local worker".into(),
                image_index: 1,
                image_count,
                step: None,
                steps: None,
                updated_at: now_ms(),
                logs: vec![],
                preview_base64: None,
                sampling_active: false,
            });
        Ok(Self { job_id, slot })
    }

    fn mutate(&self, update: impl FnOnce(&mut GenerationProgress)) {
        if let Ok(mut slot) = self.slot.lock() {
            if let Some(progress) = slot
                .as_mut()
                .filter(|p| p.job_id == self.job_id && !p.phase.terminal())
            {
                update(progress);
                progress.updated_at = now_ms();
            }
        }
    }
    pub(crate) fn phase(&self, phase: GenerationPhase, message: &str) {
        let message = clean_log(message);
        self.mutate(|progress| {
            progress.phase = phase;
            progress.message = message.clone();
            progress.step = None;
            progress.steps = None;
            append_log(progress, message);
        });
    }
    fn line(&self, line: &str) {
        if let Some(json) = line.strip_prefix("JAVLOGOS_EVENT ") {
            if let Ok(event) = serde_json::from_str::<ProgressEvent>(json) {
                if event.phase.terminal() {
                    return;
                }
                self.mutate(|progress| {
                    if event
                        .image_count
                        .is_some_and(|count| count != progress.image_count)
                    {
                        return;
                    }
                    if event
                        .image_index
                        .is_some_and(|index| index == 0 || index > progress.image_count)
                    {
                        return;
                    }
                    progress.sampling_active = event.phase == GenerationPhase::Sampling;
                    progress.phase = event.phase;
                    progress.message = clean_log(&event.message);
                    if let Some(index) = event.image_index {
                        progress.image_index = index;
                    }
                    progress.step = None;
                    progress.steps = None;
                    if let (Some(step), Some(steps)) = (event.step, event.steps) {
                        if steps > 0 && steps <= 1000 && step <= steps {
                            progress.step = Some(step);
                            progress.steps = Some(steps);
                        }
                    }
                    if let Some(preview) = event.preview_base64 {
                        if preview.len() <= 256 * 1024 {
                            if let Ok(bytes) = decode_png(&preview) {
                                let width = u32::from_be_bytes(bytes[16..20].try_into().unwrap());
                                let height = u32::from_be_bytes(bytes[20..24].try_into().unwrap());
                                if width <= 256 && height <= 256 {
                                    progress.preview_base64 = Some(preview);
                                }
                            }
                        }
                    }
                    append_log(progress, progress.message.clone());
                });
            }
            return;
        }
        let line = clean_log(line);
        if line.is_empty() {
            return;
        }
        self.mutate(|progress| {
            let lower = line.to_lowercase();
            if lower.contains("generating image:") {
                if let Some((index, count)) = fraction(&line) {
                    if count == progress.image_count && index > 0 && index <= count {
                        progress.image_index = index;
                        progress.sampling_active = true;
                        progress.phase = GenerationPhase::Sampling;
                        progress.message = format!("Sampling image {index} of {count}");
                        progress.step = None;
                        progress.steps = None;
                    }
                }
            } else if lower.contains("mb/s") || lower.contains("loading") || lower.contains("load ")
            {
                progress.phase = GenerationPhase::Loading;
                progress.message = "Loading model weights into memory".into();
                progress.step = None;
                progress.steps = None;
            } else if lower.contains("qwen3 build") || lower.contains("get_learned_condition") {
                progress.phase = GenerationPhase::Encoding;
                progress.message = "Encoding the brand description and reference".into();
                progress.step = None;
                progress.steps = None;
            } else if lower.contains("sampling completed") || lower.contains("decod") {
                progress.sampling_active = false;
                progress.phase = GenerationPhase::Decoding;
                progress.message = "Decoding generated artwork".into();
                progress.step = None;
                progress.steps = None;
            } else if (lower.contains("it/s") || lower.contains("s/it"))
                && !lower.contains("mb/s")
                && progress.sampling_active
            {
                if let Some((step, steps)) = fraction(&line) {
                    if steps > 0 && steps <= 1000 && step <= steps {
                        progress.phase = GenerationPhase::Sampling;
                        progress.step = Some(step);
                        progress.steps = Some(steps);
                        progress.message = format!("Sampling step {step} of {steps}");
                    }
                }
            }
            append_log(progress, line);
        });
    }
}
fn append_log(progress: &mut GenerationProgress, message: String) {
    if progress
        .logs
        .last()
        .is_some_and(|entry| entry.message == message)
    {
        return;
    }
    if progress.logs.len() == 80 {
        progress.logs.remove(0);
    }
    progress.logs.push(GenerationLog {
        at: now_ms(),
        message,
    });
}

pub(crate) async fn drain_diagnostics(
    mut reader: impl AsyncRead + Unpin,
    progress: Option<ProgressHandle>,
) -> AppResult<Vec<u8>> {
    const MAX_LINE: usize = 384 * 1024;
    let mut chunk = [0u8; 4096];
    let mut line = Vec::new();
    let mut truncated = false;
    let mut tail = VecDeque::new();
    let mut finish = |line: &mut Vec<u8>, truncated: &mut bool| {
        if *truncated {
            let text = "[Oversized diagnostic line omitted]".to_string();
            if let Some(handle) = &progress {
                handle.line(&text);
            }
            tail.push_back(text);
        } else if !line.is_empty() {
            let text = String::from_utf8_lossy(line);
            if let Some(handle) = &progress {
                handle.line(&text);
            }
            if !text.starts_with("JAVLOGOS_EVENT ") {
                tail.push_back(clean_log(&text));
            }
        }
        while tail.len() > 16 {
            tail.pop_front();
        }
        line.clear();
        *truncated = false;
    };
    loop {
        let count = reader
            .read(&mut chunk)
            .await
            .map_err(|error| AppError::new("WORKER_IO", error.to_string()))?;
        if count == 0 {
            break;
        }
        for byte in &chunk[..count] {
            if *byte == b'\n' || *byte == b'\r' {
                finish(&mut line, &mut truncated);
            } else if line.len() < MAX_LINE {
                line.push(*byte);
            } else {
                truncated = true;
            }
        }
    }
    finish(&mut line, &mut truncated);
    Ok(tail.into_iter().collect::<Vec<_>>().join("\n").into_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::Duration;
    use tokio::io::AsyncWriteExt;
    fn progress_handle(id: &str, count: u32) -> ProgressHandle {
        ProgressHandle {
            job_id: id.into(),
            slot: Arc::new(Mutex::new(Some(GenerationProgress {
                job_id: id.into(),
                phase: GenerationPhase::Starting,
                message: "Starting".into(),
                image_index: 1,
                image_count: count,
                step: None,
                steps: None,
                updated_at: now_ms(),
                logs: vec![],
                preview_base64: None,
                sampling_active: false,
            }))),
        }
    }
    #[test]
    fn progress_reports_real_steps_and_bounds_logs_without_path_disclosure() {
        let handle = progress_handle("job-a", 2);
        handle.line("[I] generating image: 2/2 - seed 43");
        handle.line("\u{1b}[32m |#####| 2/4 - 1.25it/s\u{1b}[K");
        {
            let slot = handle.slot.lock().unwrap();
            let value = slot.as_ref().unwrap();
            assert_eq!(value.image_index, 2);
            assert_eq!(value.phase, GenerationPhase::Sampling);
            assert_eq!(value.step, Some(2));
            assert_eq!(value.steps, Some(4));
        }
        handle.line("loading '/Users/private/person/model.gguf' 30/298 - 500MB/s");
        assert_eq!(handle.slot.lock().unwrap().as_ref().unwrap().step, None);
        handle.line("[I] sampling completed, taking 12.86s");
        handle.line("|==================================================| 1/1 - 1.01it/s");
        assert_eq!(
            handle.slot.lock().unwrap().as_ref().unwrap().phase,
            GenerationPhase::Decoding
        );
        assert_eq!(handle.slot.lock().unwrap().as_ref().unwrap().step, None);
        for number in 0..100 {
            handle.line(&format!("{number} {}", "x".repeat(1000)));
        }
        let slot = handle.slot.lock().unwrap();
        let value = slot.as_ref().unwrap();
        assert_eq!(value.logs.len(), 80);
        assert!(value
            .logs
            .iter()
            .all(|entry| entry.message.chars().count() <= 500));
        assert_eq!(
            clean_log("load '/Users/private/person/model.gguf'"),
            "load [local path]"
        );
        assert_eq!(
            clean_log("prompt: confidential description"),
            "[Prompt details omitted]"
        );
    }
    #[test]
    fn late_and_terminal_progress_cannot_overwrite_current_job() {
        let old = progress_handle("old", 1);
        old.slot.lock().unwrap().as_mut().unwrap().job_id = "new".into();
        old.line("loading old model");
        assert_eq!(
            old.slot.lock().unwrap().as_ref().unwrap().phase,
            GenerationPhase::Starting
        );
        let current = ProgressHandle {
            job_id: "new".into(),
            slot: old.slot.clone(),
        };
        current.phase(GenerationPhase::Cancelled, "Cancelled");
        current.line("|###| 4/4 - 1it/s");
        assert_eq!(
            current.slot.lock().unwrap().as_ref().unwrap().phase,
            GenerationPhase::Cancelled
        );
    }
    #[tokio::test]
    async fn diagnostics_drain_beyond_old_total_limit_and_discard_oversized_lines() {
        let handle = progress_handle("drain", 1);
        let mut data = String::new();
        for i in 0..10000 {
            data.push_str(&format!("model diagnostic {i}\n"));
        }
        data.push_str(&"x".repeat(400 * 1024));
        data.push_str("\nJAVLOGOS_EVENT {\"phase\":\"sampling\",\"message\":\"A real step\",\"imageIndex\":1,\"imageCount\":1,\"step\":3,\"steps\":4}\n");
        let tail = drain_diagnostics(data.as_bytes(), Some(handle.clone()))
            .await
            .unwrap();
        assert!(tail.len() < 16 * 501);
        let snapshot = handle.slot.lock().unwrap();
        let value = snapshot.as_ref().unwrap();
        assert_eq!(value.logs.len(), 80);
        assert_eq!(value.step, Some(3));
        assert!(value
            .logs
            .iter()
            .any(|entry| entry.message.contains("Oversized")));
    }
    #[tokio::test]
    async fn progress_is_observable_before_stderr_eof() {
        let handle = progress_handle("live", 1);
        let observer = handle.clone();
        let (mut writer, reader) = tokio::io::duplex(1024);
        let draining = tokio::spawn(drain_diagnostics(reader, Some(handle)));
        writer.write_all(b"JAVLOGOS_EVENT {\"phase\":\"encoding\",\"message\":\"Encoding now\",\"imageIndex\":1,\"imageCount\":1}\n").await.unwrap();
        tokio::time::timeout(Duration::from_secs(1), async {
            loop {
                if observer.slot.lock().unwrap().as_ref().unwrap().phase
                    == GenerationPhase::Encoding
                {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        assert!(!draining.is_finished());
        drop(writer);
        draining.await.unwrap().unwrap();
    }
    #[test]
    fn untrusted_progress_fields_cannot_expand_batch_or_preview() {
        let handle = progress_handle("bounded", 1);
        handle.line("JAVLOGOS_EVENT {\"phase\":\"sampling\",\"message\":\"Bad count\",\"imageIndex\":2,\"imageCount\":20}");
        assert_eq!(
            handle.slot.lock().unwrap().as_ref().unwrap().phase,
            GenerationPhase::Starting
        );
        handle.line("JAVLOGOS_EVENT {\"phase\":\"completed\",\"message\":\"Fake done\"}");
        assert_eq!(
            handle.slot.lock().unwrap().as_ref().unwrap().phase,
            GenerationPhase::Starting
        );
        handle.line(&format!("JAVLOGOS_EVENT {}",json!({"phase":"image-ready","message":"Image ready","previewBase64":"x".repeat(300*1024)})));
        assert!(handle
            .slot
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .preview_base64
            .is_none());
    }
}
