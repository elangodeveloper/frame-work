//! Compiler diagnostics, span tracking, and error reporting.

use std::fmt;

/// Represents a source code span with byte offsets and line/column positions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    pub line: usize,
    pub col: usize,
}

impl Span {
    pub const fn new(start: usize, end: usize, line: usize, col: usize) -> Self {
        Self { start, end, line, col }
    }

    pub const fn dummy() -> Self {
        Self { start: 0, end: 0, line: 1, col: 1 }
    }

    pub const fn len(&self) -> usize {
        self.end.saturating_sub(self.start)
    }

    pub const fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// Diagnostic severity classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Note,
}

impl fmt::Display for DiagnosticSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Error => write!(f, "error"),
            Self::Warning => write!(f, "warning"),
            Self::Note => write!(f, "note"),
        }
    }
}

/// Standard Template Compiler Error Codes:
/// - `TPL001`: Unterminated attribute string literal
/// - `TPL002`: Unexpected character inside element tag
/// - `TPL003`: Unterminated interpolation binding (`{{ ... }}`)
/// - `TPL004`: Unexpected closing tag without matching opening tag
/// - `TPL005`: Mismatched closing tag (e.g. `<h1></h2>`)
/// - `TPL006`: Unclosed element, expected closing tag before EOF
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diagnostic {
    pub code: &'static str,
    pub severity: DiagnosticSeverity,
    pub message: String,
    pub span: Span,
    pub suggestion: Option<String>,
}

impl Diagnostic {
    pub fn error(code: &'static str, message: impl Into<String>, span: Span) -> Self {
        Self {
            code,
            severity: DiagnosticSeverity::Error,
            message: message.into(),
            span,
            suggestion: None,
        }
    }

    pub fn with_suggestion(mut self, suggestion: impl Into<String>) -> Self {
        self.suggestion = Some(suggestion.into());
        self
    }
}

impl fmt::Display for Diagnostic {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "[{}] {}:{}:{}: {}: {}",
            self.code, self.span.line, self.span.col, self.severity, self.code, self.message
        )?;
        if let Some(ref sug) = self.suggestion {
            write!(f, "\n  = suggestion: {}", sug)?;
        }
        Ok(())
    }
}

impl std::error::Error for Diagnostic {}
