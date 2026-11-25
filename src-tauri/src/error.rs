use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
}

impl AppError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new("INVALID_INPUT", message)
    }
    pub fn storage(error: impl std::fmt::Display) -> Self {
        Self::new("STORAGE_ERROR", error.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
