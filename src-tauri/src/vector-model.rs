use crate::{
    error::{AppError, AppResult},
    model::{bounded, color, identifier, validate_font, Shape},
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VectorNode {
    pub id: String,
    pub x: f64,
    pub y: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub in_x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub in_y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_y: Option<f64>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VectorContour {
    pub nodes: Vec<VectorNode>,
    pub closed: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VectorPath {
    pub id: String,
    pub fill: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fill_rule: Option<String>,
    pub contours: Vec<VectorContour>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VectorDocument {
    pub shape: Shape,
    pub text: String,
    pub primary: String,
    pub background: String,
    pub font_family: String,
    pub scale: f64,
    pub rotation: f64,
    pub letter_spacing: f64,
    pub stroke_width: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slogan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_symbol: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_wordmark: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_slogan: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub monochrome: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wordmark_size: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slogan_size: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol_offset_x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symbol_offset_y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wordmark_offset_x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wordmark_offset_y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slogan_offset_x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slogan_offset_y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paths: Option<Vec<VectorPath>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motion: Option<String>,
}
fn number(value: f64, min: f64, max: f64) -> bool {
    value.is_finite() && (min..=max).contains(&value)
}
fn choice(value: &Option<String>, allowed: &[&str]) -> bool {
    value.as_deref().is_none_or(|v| allowed.contains(&v))
}
impl VectorDocument {
    pub(crate) fn validate(&self) -> AppResult<()> {
        bounded(&self.text, 120, "Logo text")?;
        validate_font(&self.font_family)?;
        if !color(&self.primary)
            || !color(&self.background)
            || !number(self.scale, 0.3, 2.0)
            || !number(self.rotation, -180.0, 180.0)
            || !number(self.letter_spacing, -5.0, 30.0)
            || !number(self.stroke_width, 0.0, 12.0)
        {
            return Err(AppError::invalid("Invalid vector appearance or transform"));
        }
        if !choice(
            &self.layout,
            &["stacked", "horizontal", "symbol", "wordmark"],
        ) || !choice(
            &self.symbol_source,
            &["geometric", "image", "trace", "custom"],
        ) || !choice(&self.motion, &["none", "fade", "assemble", "draw"])
        {
            return Err(AppError::invalid("Unsupported composition option"));
        }
        if let Some(slogan) = &self.slogan {
            bounded(slogan, 200, "Slogan")?;
        }
        if matches!(self.symbol_source.as_deref(), Some("image" | "trace"))
            && (self.monochrome == Some(true) || self.motion.as_deref() == Some("draw"))
        {
            return Err(AppError::invalid(
                "Convert the symbol to editable paths before using monochrome or draw",
            ));
        }
        if self.wordmark_size.is_some_and(|v| !number(v, 12.0, 96.0))
            || self.slogan_size.is_some_and(|v| !number(v, 10.0, 40.0))
            || [
                self.symbol_offset_x,
                self.symbol_offset_y,
                self.wordmark_offset_x,
                self.wordmark_offset_y,
                self.slogan_offset_x,
                self.slogan_offset_y,
            ]
            .into_iter()
            .flatten()
            .any(|v| !number(v, -320.0, 320.0))
        {
            return Err(AppError::invalid(
                "Composition position or size exceeds bounds",
            ));
        }
        let paths = self.paths.as_deref().unwrap_or(&[]);
        if paths.len() > 100 || self.symbol_source.as_deref() == Some("custom") && paths.is_empty()
        {
            return Err(AppError::invalid("Invalid custom symbol paths"));
        }
        let mut path_ids = HashSet::new();
        let mut node_ids: HashSet<&String> = paths.iter().map(|path| &path.id).collect();
        let mut contours = 0;
        let mut nodes = 0;
        for path in paths {
            identifier(&path.id)?;
            if !path_ids.insert(&path.id)
                || !color(&path.fill)
                || !choice(&path.fill_rule, &["evenodd", "nonzero"])
                || path.contours.is_empty()
            {
                return Err(AppError::invalid("Invalid vector path"));
            }
            contours += path.contours.len();
            for contour in &path.contours {
                nodes += contour.nodes.len();
                if contour.nodes.len() < 2 {
                    return Err(AppError::invalid("A contour requires at least two nodes"));
                }
                for node in &contour.nodes {
                    identifier(&node.id)?;
                    if !node_ids.insert(&node.id)
                        || !number(node.x, -1000.0, 1000.0)
                        || !number(node.y, -1000.0, 1000.0)
                        || node.in_x.is_some() != node.in_y.is_some()
                        || node.out_x.is_some() != node.out_y.is_some()
                        || [node.in_x, node.in_y, node.out_x, node.out_y]
                            .into_iter()
                            .flatten()
                            .any(|v| !number(v, -1000.0, 1000.0))
                    {
                        return Err(AppError::invalid("Invalid Bezier node"));
                    }
                }
            }
        }
        if contours > 200 || nodes > 3000 {
            return Err(AppError::invalid("Vector editing limits exceeded"));
        }
        Ok(())
    }
    pub(crate) fn validate_assets(&self, raster: bool, trace: bool) -> AppResult<()> {
        if self.symbol_source.as_deref() == Some("image") && !raster
            || self.symbol_source.as_deref() == Some("trace") && !trace
        {
            return Err(AppError::invalid("Composition is missing its symbol asset"));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn document() -> VectorDocument {
        serde_json::from_value(serde_json::json!({
            "shape":"orbit","text":"QA","primary":"#112233","background":"#ffffff",
            "fontFamily":"Manrope","scale":1.0,"rotation":0.0,"letterSpacing":0.0,"strokeWidth":0.0
        }))
        .unwrap()
    }
    #[test]
    fn legacy_and_expanded_documents_round_trip() {
        let mut doc = document();
        doc.validate().unwrap();
        assert!(serde_json::to_value(&doc).unwrap().get("layout").is_none());
        doc.layout = Some("horizontal".into());
        doc.slogan = Some("Brand story".into());
        doc.symbol_source = Some("image".into());
        doc.validate().unwrap();
        assert!(doc.validate_assets(false, false).is_err());
        doc.validate_assets(true, false).unwrap();
        doc.monochrome = Some(true);
        assert!(doc.validate().is_err());
        doc.monochrome = None;
        doc.motion = Some("draw".into());
        assert!(doc.validate().is_err());
    }
    #[test]
    fn rejects_duplicate_path_node_identity_and_unpaired_handles() {
        let mut doc = document();
        doc.symbol_source = Some("custom".into());
        doc.paths = Some(
            serde_json::from_value(serde_json::json!([{
                "id":"path","fill":"#112233","contours":[{"closed":true,"nodes":[
                    {"id":"path","x":0,"y":0},{"id":"second","x":10,"y":10}
                ]}]
            }]))
            .unwrap(),
        );
        assert!(doc.validate().is_err());
        let node = &mut doc.paths.as_mut().unwrap()[0].contours[0].nodes[0];
        node.id = "first".into();
        node.in_x = Some(1.0);
        assert!(doc.validate().is_err());
        doc.paths.as_mut().unwrap()[0].contours[0].nodes[0].in_y = Some(2.0);
        doc.validate().unwrap();
        let round_trip: VectorDocument =
            serde_json::from_str(&serde_json::to_string(&doc).unwrap()).unwrap();
        round_trip.validate().unwrap();
    }
}
