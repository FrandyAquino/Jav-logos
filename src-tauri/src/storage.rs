use crate::{
    error::{AppError, AppResult},
    model::Workspace,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::Duration,
};

const MAX_WORKSPACE_BYTES: usize = 128 * 1024 * 1024;

#[derive(Clone)]
pub struct Store {
    root: PathBuf,
}

#[derive(Serialize)]
pub struct LoadedWorkspace {
    pub snapshot: Option<Workspace>,
    pub revision: u64,
}

impl Store {
    pub fn open(root: impl Into<PathBuf>) -> AppResult<Self> {
        let store = Self { root: root.into() };
        fs::create_dir_all(store.root.join("assets")).map_err(AppError::storage)?;
        let connection = store.connect()?;
        let schema: u32 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .map_err(AppError::storage)?;
        if schema > 1 {
            return Err(AppError::new(
                "UNSUPPORTED_SCHEMA",
                "This workspace was created by a newer JavLogos version",
            ));
        }
        connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
            CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL CHECK(revision>=0), snapshot TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS workspace_backup (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, snapshot TEXT NOT NULL);
            PRAGMA user_version=1;").map_err(AppError::storage)?;
        let integrity: String = connection
            .pragma_query_value(None, "quick_check", |row| row.get(0))
            .map_err(AppError::storage)?;
        if integrity != "ok" {
            return Err(AppError::new(
                "CORRUPT_WORKSPACE",
                "SQLite integrity check failed. Preserve this data directory for recovery.",
            ));
        }
        Ok(store)
    }

    fn connect(&self) -> AppResult<Connection> {
        let connection =
            Connection::open(self.root.join("javlogos.sqlite3")).map_err(AppError::storage)?;
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(AppError::storage)?;
        connection
            .pragma_update(None, "synchronous", "FULL")
            .map_err(AppError::storage)?;
        Ok(connection)
    }

    pub fn load(&self) -> AppResult<LoadedWorkspace> {
        let record: Option<(u64, String)> = self
            .connect()?
            .query_row(
                "SELECT revision,snapshot FROM workspace WHERE id=1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(AppError::storage)?;
        let Some((revision, json)) = record else {
            return Ok(LoadedWorkspace {
                snapshot: None,
                revision: 0,
            });
        };
        if json.len() > MAX_WORKSPACE_BYTES {
            return Err(AppError::new(
                "CORRUPT_WORKSPACE",
                "Stored workspace exceeds supported size",
            ));
        }
        let mut snapshot: Workspace = serde_json::from_str(&json).map_err(|e| {
            AppError::new(
                "CORRUPT_WORKSPACE",
                format!("Workspace cannot be decoded: {e}. The database has not been overwritten."),
            )
        })?;
        snapshot
            .validate(true)
            .map_err(|e| AppError::new("CORRUPT_WORKSPACE", e.message))?;
        if snapshot.revision != revision {
            return Err(AppError::new(
                "CORRUPT_WORKSPACE",
                "Workspace revision is inconsistent",
            ));
        }
        let mut total = json.len();
        for concept in &mut snapshot.concepts {
            for raster in [&mut concept.raster, &mut concept.reference]
                .into_iter()
                .flatten()
            {
                if let Some(hash) = raster.strip_prefix("asset:png:") {
                    let bytes = self.read_asset(hash, "png", 18 * 1024 * 1024)?;
                    *raster = format!("data:image/png;base64,{}", STANDARD.encode(bytes));
                }
                total += raster.len();
            }
            if let Some(svg) = &mut concept.traced_svg {
                if let Some(hash) = svg.strip_prefix("asset:svg:") {
                    *svg = String::from_utf8(self.read_asset(hash, "svg", 8 * 1024 * 1024)?)
                        .map_err(|_| AppError::new("CORRUPT_ASSET", "SVG asset is not UTF-8"))?;
                }
                total += svg.len();
            }
            if total > MAX_WORKSPACE_BYTES {
                return Err(AppError::new(
                    "WORKSPACE_TOO_LARGE",
                    "Workspace assets exceed the in-memory limit",
                ));
            }
        }
        snapshot.validate(false)?;
        Ok(LoadedWorkspace {
            snapshot: Some(snapshot),
            revision,
        })
    }

    pub fn save(&self, mut snapshot: Workspace, expected_revision: u64) -> AppResult<u64> {
        snapshot.validate(false)?;
        if snapshot.revision != expected_revision || expected_revision >= i64::MAX as u64 {
            return Err(AppError::invalid("Invalid expected revision"));
        }
        let input = serde_json::to_vec(&snapshot).map_err(AppError::storage)?;
        if input.len() > MAX_WORKSPACE_BYTES {
            return Err(AppError::invalid("Workspace exceeds 128 MiB"));
        }
        let mut connection = self.connect()?;
        let tx = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(AppError::storage)?;
        let actual: u64 = tx
            .query_row("SELECT revision FROM workspace WHERE id=1", [], |row| {
                row.get(0)
            })
            .optional()
            .map_err(AppError::storage)?
            .unwrap_or(0);
        if actual != expected_revision {
            return Err(AppError::new(
                "REVISION_CONFLICT",
                "Workspace changed in another window. Reload before saving to avoid losing work.",
            ));
        }
        for concept in &mut snapshot.concepts {
            for raster in [&mut concept.raster, &mut concept.reference]
                .into_iter()
                .flatten()
            {
                let encoded = raster
                    .strip_prefix("data:image/png;base64,")
                    .ok_or_else(|| AppError::invalid("Invalid PNG data URL"))?;
                let bytes = decode_png(encoded)?;
                *raster = format!("asset:png:{}", self.write_asset(&bytes, "png")?);
            }
            if let Some(svg) = &mut concept.traced_svg {
                *svg = format!("asset:svg:{}", self.write_asset(svg.as_bytes(), "svg")?);
            }
        }
        let revision = actual + 1;
        snapshot.revision = revision;
        let json = serde_json::to_string(&snapshot).map_err(AppError::storage)?;
        tx.execute("INSERT OR REPLACE INTO workspace_backup SELECT id,revision,snapshot FROM workspace WHERE id=1", []).map_err(AppError::storage)?;
        tx.execute("INSERT INTO workspace(id,revision,snapshot) VALUES(1,?1,?2) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,snapshot=excluded.snapshot", params![revision, json]).map_err(AppError::storage)?;
        tx.commit().map_err(AppError::storage)?;
        Ok(revision)
    }

    fn write_asset(&self, bytes: &[u8], extension: &str) -> AppResult<String> {
        let hash = format!("{:x}", Sha256::digest(bytes));
        let destination = self.root.join("assets").join(format!("{hash}.{extension}"));
        if !destination.exists() {
            atomic_write(&destination, bytes)?;
        }
        Ok(hash)
    }

    fn read_asset(&self, hash: &str, extension: &str, max: u64) -> AppResult<Vec<u8>> {
        if hash.len() != 64 || !hash.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(AppError::new(
                "CORRUPT_ASSET",
                "Invalid stored asset identifier",
            ));
        }
        let path = self.root.join("assets").join(format!("{hash}.{extension}"));
        if fs::metadata(&path).map_err(AppError::storage)?.len() > max {
            return Err(AppError::new("CORRUPT_ASSET", "Asset exceeds size limit"));
        }
        let bytes = fs::read(path).map_err(AppError::storage)?;
        if format!("{:x}", Sha256::digest(&bytes)) != hash {
            return Err(AppError::new(
                "CORRUPT_ASSET",
                "Stored asset checksum does not match",
            ));
        }
        Ok(bytes)
    }
}

pub fn decode_png(encoded: &str) -> AppResult<Vec<u8>> {
    if encoded.len() > 24 * 1024 * 1024 {
        return Err(AppError::invalid("PNG exceeds size limit"));
    }
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| AppError::invalid("PNG base64 is malformed"))?;
    if bytes.len() < 24 || !bytes.starts_with(b"\x89PNG\r\n\x1a\n") || &bytes[12..16] != b"IHDR" {
        return Err(AppError::invalid("Image is not a PNG"));
    }
    let width = u32::from_be_bytes(bytes[16..20].try_into().expect("fixed range"));
    let height = u32::from_be_bytes(bytes[20..24].try_into().expect("fixed range"));
    if width == 0
        || height == 0
        || width > 8192
        || height > 8192
        || u64::from(width) * u64::from(height) > 32_000_000
    {
        return Err(AppError::invalid("PNG dimensions exceed limit"));
    }
    Ok(bytes)
}

pub fn atomic_write(destination: &Path, bytes: &[u8]) -> AppResult<()> {
    let parent = destination
        .parent()
        .ok_or_else(|| AppError::invalid("Output has no parent directory"))?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent).map_err(AppError::storage)?;
    temporary.write_all(bytes).map_err(AppError::storage)?;
    temporary.as_file().sync_all().map_err(AppError::storage)?;
    temporary.persist(destination).map_err(AppError::storage)?;
    #[cfg(unix)]
    fs::File::open(parent)
        .and_then(|directory| directory.sync_all())
        .map_err(AppError::storage)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn empty() -> Workspace {
        Workspace {
            schema_version: 1,
            revision: 0,
            brands: vec![],
            concepts: vec![],
        }
    }

    #[test]
    fn persists_across_reopen_and_rejects_stale_write() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).unwrap();
        assert!(store.load().unwrap().snapshot.is_none());
        assert_eq!(store.save(empty(), 0).unwrap(), 1);
        let reopened = Store::open(dir.path()).unwrap();
        assert_eq!(reopened.load().unwrap().snapshot.unwrap().revision, 1);
        assert_eq!(
            store.save(empty(), 0).unwrap_err().code,
            "REVISION_CONFLICT"
        );
        assert_eq!(reopened.load().unwrap().revision, 1);
    }

    #[test]
    fn corrupt_snapshot_is_not_silently_reinitialized() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).unwrap();
        store.save(empty(), 0).unwrap();
        store
            .connect()
            .unwrap()
            .execute("UPDATE workspace SET snapshot='broken'", [])
            .unwrap();
        assert!(matches!(
            store.load(),
            Err(AppError {
                code: "CORRUPT_WORKSPACE",
                ..
            })
        ));
    }

    #[test]
    fn assets_are_content_addressed_and_checked() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).unwrap();
        let hash = store.write_asset(b"<svg/>", "svg").unwrap();
        assert_eq!(store.read_asset(&hash, "svg", 100).unwrap(), b"<svg/>");
        fs::write(
            dir.path().join("assets").join(format!("{hash}.svg")),
            b"tampered",
        )
        .unwrap();
        assert!(store.read_asset(&hash, "svg", 100).is_err());
        assert!(store.read_asset("../../secrets", "svg", 100).is_err());
    }

    #[test]
    fn atomic_output_replaces_only_after_success() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("kit.zip");
        fs::write(&path, b"old").unwrap();
        atomic_write(&path, b"new").unwrap();
        assert_eq!(fs::read(path).unwrap(), b"new");
    }

    #[test]
    fn hierarchy_cycle_is_rejected_without_touching_saved_data() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).unwrap();
        let mut invalid = empty();
        invalid.brands.push(crate::model::Brand {
            id: "brand-a".into(),
            name: "Brand".into(),
            parent_id: Some("brand-a".into()),
            created_at: "2026-11-25".into(),
            status: None,
            pinned: None,
            order: None,
            icon: None,
            dna: crate::model::Dna {
                palette: None,
                typography: None,
                geometry: None,
                tone: None,
            },
        });
        assert_eq!(store.save(invalid, 0).unwrap_err().code, "INVALID_INPUT");
        assert!(store.load().unwrap().snapshot.is_none());
    }

    #[test]
    fn assets_round_trip_through_snapshot_and_disk() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).unwrap();
        let png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nksAAAAASUVORK5CYII=";
        let input = serde_json::json!({
            "schemaVersion":1,"revision":0,
            "brands":[{"id":"brand-a","name":"Brand","parentId":null,"dna":{},"createdAt":"2026-11-25","status":"completed","pinned":true,"order":2,"icon":"spark"}],
            "concepts":[{"id":"concept-a","brandId":"brand-a","name":"Concept","prompt":"Test","provider":"test","seed":42,"createdAt":"2026-11-25",
                "document":{"shape":"orbit","text":"Brand","primary":"#112233","background":"#ffffff","fontFamily":"Manrope","scale":1,"rotation":0,"letterSpacing":0,"strokeWidth":2},
                "raster":png,"reference":png,"tracedSvg":"<svg xmlns=\"http://www.w3.org/2000/svg\"/>","versions":[],
                "generationContext":{"effectivePrompt":"A blue geometric logo","width":512,"height":512,"dna":{"palette":["#112233"],"typography":"Inter","geometry":"orbit","tone":"Calm"}}}]
        });
        store
            .save(serde_json::from_value(input).unwrap(), 0)
            .unwrap();
        let snapshot = store.load().unwrap().snapshot.unwrap();
        assert_eq!(snapshot.brands[0].status.as_deref(), Some("completed"));
        assert_eq!(snapshot.brands[0].pinned, Some(true));
        assert_eq!(snapshot.brands[0].icon.as_deref(), Some("spark"));
        assert_eq!(snapshot.concepts[0].document.font_family, "Manrope");
        assert_eq!(snapshot.concepts[0].raster.as_deref(), Some(png));
        assert_eq!(snapshot.concepts[0].reference.as_deref(), Some(png));
        assert_eq!(
            snapshot.concepts[0]
                .generation_context
                .as_ref()
                .unwrap()
                .effective_prompt,
            "A blue geometric logo"
        );
        assert_eq!(
            snapshot.concepts[0].traced_svg.as_deref(),
            Some("<svg xmlns=\"http://www.w3.org/2000/svg\"/>")
        );
        let saved: String = store
            .connect()
            .unwrap()
            .query_row("SELECT snapshot FROM workspace", [], |row| row.get(0))
            .unwrap();
        assert!(saved.contains("asset:png:"));
        assert!(!saved.contains(png));
    }

    #[test]
    fn concurrent_writes_with_same_revision_cannot_both_succeed() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(dir.path()).unwrap();
        let other = store.clone();
        let first = std::thread::spawn(move || other.save(empty(), 0));
        let second = store.save(empty(), 0);
        let first = first.join().unwrap();
        assert_ne!(first.is_ok(), second.is_ok());
        assert_eq!(store.load().unwrap().revision, 1);
    }
}
