use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Workspace {
    pub schema_version: u32,
    pub revision: u64,
    pub brands: Vec<Brand>,
    pub concepts: Vec<Concept>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Brand {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub book: Option<BrandBook>,
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub dna: Dna,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pinned: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Dna {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub palette: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub typography: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub geometry: Option<Shape>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tone: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Shape {
    Orbit,
    Petal,
    Monogram,
    Prism,
    Wave,
    Grid,
}

pub use crate::vector_model::VectorDocument;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ConceptVersion {
    pub id: String,
    pub created_at: String,
    pub document: VectorDocument,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Concept {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub favorite: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub id: String,
    pub brand_id: String,
    pub name: String,
    pub prompt: String,
    pub provider: String,
    pub seed: u64,
    pub created_at: String,
    pub document: VectorDocument,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raster: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cutout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub derived_from: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refinement: Option<Refinement>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub traced_svg: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generation_context: Option<GenerationContext>,
    pub versions: Vec<ConceptVersion>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Refinement {
    pub kind: String,
    pub instruction: String,
    pub before: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GenerationContext {
    pub effective_prompt: String,
    pub dna: Dna,
    pub width: u32,
    pub height: u32,
}

pub(crate) fn bounded(value: &str, max: usize, label: &str) -> AppResult<()> {
    if value.encode_utf16().count() > max || value.contains('\0') {
        return Err(AppError::invalid(format!(
            "{label} exceeds allowed length or contains NUL"
        )));
    }
    Ok(())
}

pub fn identifier(value: &str) -> AppResult<()> {
    if value.is_empty()
        || value.len() > 128
        || !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err(AppError::invalid("Invalid identifier"));
    }
    Ok(())
}

pub(crate) fn color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}

pub(crate) fn validate_font(font: &str) -> AppResult<()> {
    static FONTS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
    let fonts = FONTS.get_or_init(|| {
        serde_json::from_str(include_str!("../../shared/font-families.json"))
            .expect("valid bundled font catalogue")
    });
    if !fonts.iter().any(|family| family == font) {
        return Err(AppError::invalid("Unsupported typography"));
    }
    Ok(())
}
impl Dna {
    fn validate(&self) -> AppResult<()> {
        if let Some(palette) = &self.palette {
            if palette.is_empty() || palette.len() > 8 || !palette.iter().all(|c| color(c)) {
                return Err(AppError::invalid("Invalid brand palette"));
            }
        }
        if let Some(font) = &self.typography {
            validate_font(font)?;
        }
        if let Some(tone) = &self.tone {
            bounded(tone, 500, "Tone")?;
        }
        Ok(())
    }
}

impl Workspace {
    pub fn validate(&self, stored: bool) -> AppResult<()> {
        if self.schema_version != 1
            || self.revision > i64::MAX as u64
            || self.brands.len() > 1000
            || self.concepts.len() > 2000
        {
            return Err(AppError::invalid(
                "Unsupported workspace schema or workspace too large",
            ));
        }
        let mut ids = HashSet::new();
        let mut parents = HashMap::new();
        for brand in &self.brands {
            identifier(&brand.id)?;
            if !ids.insert(&brand.id) {
                return Err(AppError::invalid("Duplicate brand identifier"));
            }
            bounded(&brand.name, 120, "Brand name")?;
            if brand.name.trim().is_empty() {
                return Err(AppError::invalid("Brand name is required"));
            }
            bounded(&brand.created_at, 64, "Creation date")?;
            brand.dna.validate()?;
            if let Some(book) = &brand.book {
                book.validate()?;
            }
            if brand
                .status
                .as_deref()
                .is_some_and(|v| !["active", "completed", "archived"].contains(&v))
                || brand.order.is_some_and(|v| v > 1_000_000)
                || brand.icon.as_deref().is_some_and(|v| {
                    ![
                        "diamond", "orbit", "flower", "type", "triangle", "waves", "grid",
                        "layers", "spark",
                    ]
                    .contains(&v)
                })
            {
                return Err(AppError::invalid("Invalid brand organization metadata"));
            }
            parents.insert(&brand.id, &brand.parent_id);
        }
        for brand in &self.brands {
            let mut path = HashSet::new();
            let mut current = Some(&brand.id);
            while let Some(id) = current {
                if !path.insert(id) {
                    return Err(AppError::invalid("Brand hierarchy contains a cycle"));
                }
                current = parents
                    .get(id)
                    .ok_or_else(|| AppError::invalid("Parent brand does not exist"))?
                    .as_ref();
            }
        }
        let mut concept_ids = HashSet::new();
        for concept in &self.concepts {
            identifier(&concept.id)?;
            if !concept_ids.insert(&concept.id) || !ids.contains(&concept.brand_id) {
                return Err(AppError::invalid("Duplicate concept or missing brand"));
            }
            bounded(&concept.name, 120, "Concept name")?;
            if let Some(refinement) = &concept.refinement {
                if concept.derived_from.is_none()
                    || !["composition", "ai"].contains(&refinement.kind.as_str())
                    || refinement.instruction.trim().is_empty()
                {
                    return Err(AppError::invalid("Invalid refinement provenance"));
                }
                bounded(&refinement.instruction, 1500, "Refinement instruction")?;
            }
            if let Some(source) = &concept.derived_from {
                identifier(source)?;
            }
            bounded(&concept.prompt, 4000, "Prompt")?;
            bounded(&concept.provider, 100, "Provider")?;
            if concept.seed > 9_007_199_254_740_991 {
                return Err(AppError::invalid("Seed exceeds safe integer range"));
            }
            if let Some(context) = &concept.generation_context {
                bounded(&context.effective_prompt, 6000, "Effective prompt")?;
                context.dna.validate()?;
                if context.dna.palette.is_none()
                    || context.dna.typography.is_none()
                    || context.dna.geometry.is_none()
                    || context.dna.tone.is_none()
                    || !(256..=1024).contains(&context.width)
                    || !(256..=1024).contains(&context.height)
                {
                    return Err(AppError::invalid("Incomplete generation context"));
                }
            }
            bounded(&concept.created_at, 64, "Creation date")?;
            concept.document.validate()?;
            concept.document.validate_assets(
                concept.raster.is_some(),
                concept.traced_svg.is_some(),
                concept.cutout.is_some(),
            )?;
            if let Some(notes) = &concept.notes {
                bounded(notes, 3000, "Concept notes")?;
            }
            if concept.versions.len() > 100 {
                return Err(AppError::invalid("Too many concept versions"));
            }
            let mut version_ids = HashSet::new();
            for version in &concept.versions {
                identifier(&version.id)?;
                if !version_ids.insert(&version.id) {
                    return Err(AppError::invalid("Duplicate version identifier"));
                }
                bounded(&version.created_at, 64, "Version date")?;
                version.document.validate()?;
                version.document.validate_assets(
                    concept.raster.is_some(),
                    concept.traced_svg.is_some(),
                    concept.cutout.is_some(),
                )?;
            }
            for raster in [&concept.raster, &concept.reference, &concept.cutout]
                .into_iter()
                .flatten()
                .chain(
                    concept
                        .refinement
                        .as_ref()
                        .map(|refinement| &refinement.before),
                )
            {
                bounded(raster, 16_000_000, "Raster")?;
                if !(raster.starts_with("data:image/png;base64,")
                    || stored && raster.starts_with("asset:png:"))
                {
                    return Err(AppError::invalid("Raster must be a PNG data URL"));
                }
            }
            if let Some(svg) = &concept.traced_svg {
                bounded(svg, 8_000_000, "SVG")?;
                if !(svg.trim_start().starts_with('<') || stored && svg.starts_with("asset:svg:")) {
                    return Err(AppError::invalid("Invalid vector payload"));
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unicode_limits_match_frontend_utf16_units() {
        assert!(bounded(&"品".repeat(4000), 4000, "Prompt").is_ok());
        assert!(bounded(&"品".repeat(4001), 4000, "Prompt").is_err());
        assert!(bounded(&"🚀".repeat(60), 120, "Brand").is_ok());
        assert!(bounded(&"🚀".repeat(61), 120, "Brand").is_err());
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrandBook {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headline: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
}
impl BrandBook {
    fn validate(&self) -> AppResult<()> {
        for (value, max, label) in [
            (&self.headline, 200, "Book headline"),
            (&self.overview, 3000, "Book overview"),
            (&self.usage_notes, 3000, "Book usage notes"),
            (&self.voice, 1500, "Book voice"),
        ] {
            if let Some(value) = value {
                bounded(value, max, label)?;
            }
        }
        Ok(())
    }
}
