use super::*;
use serde_json::json;
use std::{collections::BTreeSet, time::Instant};

fn measured<T>(run: impl FnOnce() -> T) -> (T, f64) {
    let start = Instant::now();
    let value = run();
    (value, start.elapsed().as_secs_f64() * 1000.0)
}
fn median(values: &mut [f64]) -> f64 {
    values.sort_by(f64::total_cmp);
    values[values.len() / 2]
}
fn assets(root: &Path) -> (usize, u64) {
    let entries: Vec<_> = fs::read_dir(root.join("assets"))
        .unwrap()
        .map(|entry| entry.unwrap().metadata().unwrap().len())
        .collect();
    (entries.len(), entries.iter().sum())
}
fn disk_bytes(root: &Path) -> u64 {
    fs::read_dir(root)
        .unwrap()
        .map(|entry| {
            let entry = entry.unwrap();
            if entry.file_type().unwrap().is_dir() {
                disk_bytes(&entry.path())
            } else {
                entry.metadata().unwrap().len()
            }
        })
        .sum()
}
fn referenced_assets(store: &Store) -> BTreeSet<String> {
    let connection = store.connect().unwrap();
    let mut query = connection
        .prepare("SELECT snapshot FROM workspace UNION ALL SELECT snapshot FROM workspace_backup")
        .unwrap();
    let mut marked = BTreeSet::new();
    for json in query.query_map([], |row| row.get::<_, String>(0)).unwrap() {
        let workspace: Workspace = serde_json::from_str(&json.unwrap()).unwrap();
        for concept in workspace.concepts {
            for reference in [
                concept.raster,
                concept.reference,
                concept.cutout,
                concept.traced_svg,
            ]
            .into_iter()
            .flatten()
            {
                if let Some(hash) = reference.strip_prefix("asset:png:") {
                    marked.insert(format!("{hash}.png"));
                }
                if let Some(hash) = reference.strip_prefix("asset:svg:") {
                    marked.insert(format!("{hash}.svg"));
                }
            }
        }
    }
    marked
}

#[test]
#[ignore = "opt-in temp-directory performance diagnostic; run node scripts/performance-baseline.mjs"]
fn workspace_performance_baseline() {
    let fixtures = PathBuf::from(
        std::env::var("JAVLOGOS_PERF_DIR").expect("use scripts/performance-baseline.mjs"),
    );
    for count in [100, 500, 2000] {
        let bytes = fs::read(fixtures.join(format!("workspace-{count}.json"))).unwrap();
        let fixture: Workspace = serde_json::from_slice(&bytes).unwrap();
        let mut samples = vec![Vec::new(); 9];
        let mut disk = json!(null);
        for _ in 0..5 {
            let directory = tempfile::tempdir().unwrap();
            let store = Store::open(directory.path()).unwrap();
            let input = fixture.clone();
            let (revision, elapsed) = measured(|| store.save(input, 0).unwrap());
            samples[0].push(elapsed);
            samples[6].push(measured(|| fixture.validate(false).unwrap()).1);
            samples[7].push(measured(|| serde_json::to_vec(&fixture).unwrap()).1);
            samples[8].push(
                measured(|| {
                    for concept in &fixture.concepts {
                        for raster in [&concept.raster, &concept.reference, &concept.cutout]
                            .into_iter()
                            .flatten()
                        {
                            store
                                .write_asset(
                                    &decode_png(
                                        raster.strip_prefix("data:image/png;base64,").unwrap(),
                                    )
                                    .unwrap(),
                                    "png",
                                )
                                .unwrap();
                        }
                        if let Some(svg) = &concept.traced_svg {
                            store.write_asset(svg.as_bytes(), "svg").unwrap();
                        }
                    }
                })
                .1,
            );
            let (loaded, elapsed) = measured(|| store.load().unwrap());
            samples[1].push(elapsed);
            let mut snapshot = loaded.snapshot.unwrap();
            assert_eq!(snapshot.concepts.len(), count);
            assert_eq!(snapshot.concepts[0].raster, fixture.concepts[0].raster);
            snapshot.concepts[0].name = "Edited one concept".into();
            let input = snapshot.clone();
            let (revision, elapsed) = measured(|| store.save(input, revision).unwrap());
            samples[2].push(elapsed);
            snapshot.revision = revision;
            for concept in &mut snapshot.concepts {
                concept.document.rotation = 10.0;
            }
            let input = snapshot.clone();
            let (revision, elapsed) = measured(|| store.save(input, revision).unwrap());
            samples[3].push(elapsed);
            snapshot.revision = revision;
            let input = fixture.clone();
            let (error, elapsed) = measured(|| store.save(input, 0).unwrap_err());
            assert_eq!(error.code, "REVISION_CONFLICT");
            samples[5].push(elapsed);
            snapshot.concepts.remove(0);
            let input = snapshot.clone();
            let (revision, elapsed) = measured(|| store.save(input, revision).unwrap());
            samples[4].push(elapsed);
            snapshot.revision = revision;
            let after_delete = assets(directory.path());
            // Advance backup past deletion: GC must retain BOTH DB snapshots.
            snapshot.revision = store.save(snapshot.clone(), revision).unwrap();
            let marks = referenced_assets(&store);
            let before_failure = assets(directory.path());
            store.connect().unwrap().execute_batch("CREATE TRIGGER fail_save BEFORE UPDATE ON workspace BEGIN SELECT RAISE(ABORT,'perf injected save failure'); END;").unwrap();
            snapshot.concepts[0].traced_svg = Some(
                "<svg xmlns=\"http://www.w3.org/2000/svg\"><!-- failed write --></svg>".into(),
            );
            let persisted_revision = snapshot.revision;
            assert!(store.save(snapshot, persisted_revision).is_err());
            assert_eq!(store.load().unwrap().revision, persisted_revision);
            let after_failure = assets(directory.path());
            assert_eq!(after_failure.0, before_failure.0 + 1);
            assert_eq!(after_delete.0 - marks.len(), 2);
            let connection = store.connect().unwrap();
            let journal: String = connection
                .pragma_query_value(None, "journal_mode", |row| row.get(0))
                .unwrap();
            let synchronous: u32 = connection
                .pragma_query_value(None, "synchronous", |row| row.get(0))
                .unwrap();
            let snapshot_bytes: usize = connection
                .query_row("SELECT length(snapshot) FROM workspace", [], |row| {
                    row.get(0)
                })
                .unwrap();
            disk = json!({"assetCountAfterDelete":after_delete.0,"assetBytes":after_delete.1,"unreferencedAfterBackupAdvance":after_delete.0-marks.len(),"failedSaveNewOrphans":after_failure.0-before_failure.0,"diskBytesAfterFailure":disk_bytes(directory.path()),"dbSnapshotBytes":snapshot_bytes,"journal":journal,"synchronous":synchronous});
        }
        let medians: Vec<_> = samples.iter_mut().map(|values| median(values)).collect();
        println!(
            "PERF_RUST {}",
            json!({"concepts":count,"brands":fixture.brands.len(),"runs":5,"inputBytes":bytes.len(),"medianMs":{"seed":medians[0],"load":medians[1],"saveOne":medians[2],"saveAll":medians[3],"deleteOne":medians[4],"staleReject":medians[5],"validateOnly":medians[6],"serializeOnly":medians[7],"replayExistingAssetsOnly":medians[8]},"samplesMs":samples,"disk":disk})
        );
    }
    // Boundary diagnostic: valid per-field assets, serialized input just below
    // the cap. Load currently counts stored asset-token bytes again after hydration.
    let mut boundary: Workspace =
        serde_json::from_slice(&fs::read(fixtures.join("workspace-2000.json")).unwrap()).unwrap();
    let input_bytes = serde_json::to_vec(&boundary).unwrap().len();
    let padding = MAX_WORKSPACE_BYTES - 1024 - input_bytes;
    for index in 0..16 {
        let amount = padding / 16 + usize::from(index < padding % 16);
        boundary.concepts[index]
            .traced_svg
            .as_mut()
            .unwrap()
            .push_str(&" ".repeat(amount));
    }
    let accepted_bytes = serde_json::to_vec(&boundary).unwrap().len();
    assert!(accepted_bytes < MAX_WORKSPACE_BYTES);
    let directory = tempfile::tempdir().unwrap();
    let store = Store::open(directory.path()).unwrap();
    store.save(boundary, 0).unwrap();
    let load_error = match store.load() {
        Ok(_) => panic!("Update baseline: cap asymmetry is fixed"),
        Err(error) => error,
    };
    assert_eq!(load_error.code, "WORKSPACE_TOO_LARGE");
    println!(
        "PERF_LIMIT {}",
        json!({"acceptedSaveBytes":accepted_bytes,"reloadError":load_error.code,"capBytes":MAX_WORKSPACE_BYTES})
    );
}
