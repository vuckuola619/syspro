use serde::Serialize;

/// Central error type for all SABI backend operations.
#[derive(Debug, thiserror::Error)]
pub enum SabiError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Registry error: {0}")]
    Registry(String),

    #[error("PowerShell command failed: {0}")]
    PowerShell(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("{0}")]
    General(String),
}

/// Structured error payload sent to the frontend as JSON.
#[derive(Serialize)]
struct ErrorPayload {
    code: String,
    message: String,
    recoverable: bool,
}

impl SabiError {
    fn code(&self) -> &'static str {
        match self {
            SabiError::Io(_) => "IO_ERROR",
            SabiError::Registry(_) => "REGISTRY_ERROR",
            SabiError::PowerShell(_) => "POWERSHELL_ERROR",
            SabiError::PermissionDenied(_) => "PERMISSION_DENIED",
            SabiError::NotFound(_) => "NOT_FOUND",
            SabiError::Serde(_) => "SERDE_ERROR",
            SabiError::InvalidInput(_) => "INVALID_INPUT",
            SabiError::General(_) => "GENERAL_ERROR",
        }
    }

    fn is_recoverable(&self) -> bool {
        matches!(
            self,
            SabiError::NotFound(_) | SabiError::InvalidInput(_) | SabiError::General(_)
        )
    }
}

impl From<SabiError> for tauri::ipc::InvokeError {
    fn from(err: SabiError) -> Self {
        let payload = ErrorPayload {
            code: err.code().to_string(),
            message: err.to_string(),
            recoverable: err.is_recoverable(),
        };
        // Serialize as JSON value for structured frontend consumption
        let json = serde_json::to_value(payload).unwrap_or_else(|_| {
            serde_json::json!({ "code": "UNKNOWN", "message": err.to_string(), "recoverable": false })
        });
        tauri::ipc::InvokeError::from(json)
    }
}

/// Convenience type alias for Tauri command return values.
pub type SabiResult<T> = Result<T, SabiError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_code_mapping() {
        let err = SabiError::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "missing"));
        assert_eq!(err.code(), "IO_ERROR");
        assert!(!err.is_recoverable());

        let err = SabiError::InvalidInput("bad input".to_string());
        assert_eq!(err.code(), "INVALID_INPUT");
        assert!(err.is_recoverable());
    }

    #[test]
    fn test_error_display() {
        let err = SabiError::PowerShell("script failed".to_string());
        assert_eq!(err.to_string(), "PowerShell command failed: script failed");
    }

    #[test]
    fn test_error_to_json_payload() {
        let err = SabiError::Registry("key not found".to_string());
        let payload = ErrorPayload {
            code: err.code().to_string(),
            message: err.to_string(),
            recoverable: err.is_recoverable(),
        };
        let json = serde_json::to_value(payload).unwrap();
        assert_eq!(json["code"], "REGISTRY_ERROR");
        assert_eq!(json["recoverable"], false);
    }
}
