//! High-performance Lexer scanning template markup into zero-allocation tokens.

use crate::ast::is_raw_text_tag;
use crate::diagnostics::{Diagnostic, Span};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenKind<'a> {
    /// `<tag`
    TagOpenStart(&'a str),
    /// `>`
    TagOpenEnd,
    /// `</tag>`
    TagClose(&'a str),
    /// `/>`
    TagSelfClose,
    /// Attribute name: `id`, `[disabled]`, `(click)`, `[(value)]`
    AttributeName(&'a str),
    /// `=`
    Equals,
    /// Attribute string value
    AttributeValue(&'a str),
    /// Plain text
    Text(&'a str),
    /// Reactive interpolation `{{ expr }}`
    Interpolation(&'a str),
    /// HTML comment `<!-- comment -->`
    Comment(&'a str),
    /// Raw text content inside `<script>` or `<style>`
    RawText(&'a str),
    /// Control flow `@if`
    AtIf,
    /// Control flow `@else`
    AtElse,
    /// Control flow `@for`
    AtFor,
    /// `(`
    LParen,
    /// `)`
    RParen,
    /// `{`
    LBrace,
    /// `}`
    RBrace,
    /// `;`
    Semicolon,
    /// End of input
    Eof,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Token<'a> {
    pub kind: TokenKind<'a>,
    pub span: Span,
}

pub struct Lexer<'a> {
    source: &'a str,
    cursor: usize,
    line: usize,
    col: usize,
    pub diagnostics: Vec<Diagnostic>,
    raw_text_tag: Option<&'a str>,
    control_flow_depth: usize,
    in_control_header: bool,
}

impl<'a> Lexer<'a> {
    pub fn new(source: &'a str) -> Self {
        Self {
            source,
            cursor: 0,
            line: 1,
            col: 1,
            diagnostics: Vec::new(),
            raw_text_tag: None,
            control_flow_depth: 0,
            in_control_header: false,
        }
    }

    pub fn diagnostics(&self) -> &[Diagnostic] {
        &self.diagnostics
    }

    fn peek(&self) -> Option<char> {
        self.source[self.cursor..].chars().next()
    }

    fn peek_ahead(&self, n: usize) -> Option<char> {
        self.source[self.cursor..].chars().nth(n)
    }

    fn starts_with(&self, s: &str) -> bool {
        self.source[self.cursor..].starts_with(s)
    }

    fn bump(&mut self) -> Option<char> {
        let ch = self.peek()?;
        self.cursor += ch.len_utf8();
        if ch == '\n' {
            self.line += 1;
            self.col = 1;
        } else {
            self.col += 1;
        }
        Some(ch)
    }

    fn current_span(&self, start_cursor: usize, start_line: usize, start_col: usize) -> Span {
        Span::new(start_cursor, self.cursor, start_line, start_col)
    }

    pub fn tokenize_all(&mut self) -> Result<Vec<Token<'a>>, Diagnostic> {
        let tokens = self.tokenize();
        if let Some(err) = self.diagnostics.first() {
            Err(err.clone())
        } else {
            Ok(tokens)
        }
    }

    pub fn tokenize(&mut self) -> Vec<Token<'a>> {
        let mut tokens = Vec::new();
        let mut inside_tag = false;
        let mut current_tag = "";

        while let Some(ch) = self.peek() {
            let start_cursor = self.cursor;
            let start_line = self.line;
            let start_col = self.col;

            // Handle raw-text element content: <script> or <style>
            if let Some(raw_tag) = self.raw_text_tag {
                let close_pattern = format!("</{}", raw_tag);
                let raw_start = self.cursor;
                let mut found_close = false;

                while self.cursor < self.source.len() {
                    let remaining = &self.source[self.cursor..];
                    if remaining.len() >= close_pattern.len()
                        && remaining[..close_pattern.len()].eq_ignore_ascii_case(&close_pattern)
                    {
                        found_close = true;
                        break;
                    }
                    self.bump();
                }

                let raw_content = &self.source[raw_start..self.cursor];
                if !raw_content.is_empty() {
                    tokens.push(Token {
                        kind: TokenKind::RawText(raw_content),
                        span: Span::new(raw_start, self.cursor, start_line, start_col),
                    });
                }

                self.raw_text_tag = None;

                if found_close {
                    let close_start = self.cursor;
                    let close_line = self.line;
                    let close_col = self.col;
                    // Bump past `</` and tag
                    self.bump(); // '<'
                    self.bump(); // '/'
                    let tag_start = self.cursor;
                    while let Some(c) = self.peek() {
                        if c == '>' || c.is_whitespace() {
                            break;
                        }
                        self.bump();
                    }
                    let tag_name = &self.source[tag_start..self.cursor];
                    while let Some(c) = self.peek() {
                        if c == '>' {
                            self.bump();
                            break;
                        }
                        self.bump();
                    }
                    tokens.push(Token {
                        kind: TokenKind::TagClose(tag_name),
                        span: self.current_span(close_start, close_line, close_col),
                    });
                }
                continue;
            }

            if inside_tag {
                // Inside tag: `<tag ...>`
                if ch.is_whitespace() {
                    self.bump();
                    continue;
                }

                if ch == '/' && self.peek_ahead(1) == Some('>') {
                    self.bump();
                    self.bump();
                    inside_tag = false;
                    tokens.push(Token {
                        kind: TokenKind::TagSelfClose,
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                    continue;
                }

                if ch == '>' {
                    self.bump();
                    inside_tag = false;
                    tokens.push(Token {
                        kind: TokenKind::TagOpenEnd,
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                    if is_raw_text_tag(current_tag) {
                        self.raw_text_tag = Some(current_tag);
                    }
                    continue;
                }

                if ch == '=' {
                    self.bump();
                    tokens.push(Token {
                        kind: TokenKind::Equals,
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                    continue;
                }

                // Attribute value in quotes
                if ch == '"' || ch == '\'' {
                    let quote = ch;
                    self.bump(); // consume opening quote
                    let val_start = self.cursor;
                    let mut closed = false;

                    while let Some(c) = self.peek() {
                        if c == quote {
                            closed = true;
                            break;
                        }
                        if c == '>' || c == '\n' {
                            break;
                        }
                        self.bump();
                    }

                    let val_str = &self.source[val_start..self.cursor];
                    if closed {
                        self.bump(); // consume closing quote
                    } else {
                        let span = self.current_span(start_cursor, start_line, start_col);
                        self.diagnostics.push(Diagnostic::error(
                            "TPL001",
                            "Unterminated attribute string literal",
                            span,
                        ));
                    }

                    tokens.push(Token {
                        kind: TokenKind::AttributeValue(val_str),
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                    continue;
                }

                // Attribute name: must start with valid character
                let is_valid_attr_start = ch.is_ascii_alphabetic()
                    || ch == '_'
                    || ch == ':'
                    || ch == '@'
                    || ch == '['
                    || ch == '(';

                if is_valid_attr_start {
                    let name_start = self.cursor;
                    while let Some(c) = self.peek() {
                        if c.is_whitespace() || c == '=' || c == '>' || c == '/' || c == '"' || c == '\'' {
                            break;
                        }
                        self.bump();
                    }

                    if self.cursor > name_start {
                        let attr_name = &self.source[name_start..self.cursor];
                        tokens.push(Token {
                            kind: TokenKind::AttributeName(attr_name),
                            span: self.current_span(start_cursor, start_line, start_col),
                        });
                        continue;
                    }
                }

                // Unexpected character inside tag (TPL002 error recovery)
                let span = Span::new(start_cursor, start_cursor + ch.len_utf8(), start_line, start_col);
                self.diagnostics.push(Diagnostic::error(
                    "TPL002",
                    format!("Unexpected character '{}' inside element tag", ch),
                    span,
                ));
                self.bump();
            } else {
                // Outside tag

                // 1. Comments: <!-- ... -->
                if self.starts_with("<!--") {
                    self.bump(); // '<'
                    self.bump(); // '!'
                    self.bump(); // '-'
                    self.bump(); // '-'
                    let comment_start = self.cursor;
                    while self.cursor < self.source.len() {
                        if self.starts_with("-->") {
                            break;
                        }
                        self.bump();
                    }
                    let comment_str = &self.source[comment_start..self.cursor];
                    if self.starts_with("-->") {
                        self.bump();
                        self.bump();
                        self.bump();
                    }
                    tokens.push(Token {
                        kind: TokenKind::Comment(comment_str),
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                    continue;
                }

                // 2. Control flow: @if, @else, @for
                if self.starts_with("@if") && matches!(self.peek_ahead(3), Some(' ' | '\t' | '\n' | '\r' | '(')) {
                    self.bump(); // '@'
                    self.bump(); // 'i'
                    self.bump(); // 'f'
                    self.control_flow_depth += 1;
                    self.in_control_header = true;
                    tokens.push(Token {
                        kind: TokenKind::AtIf,
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                    continue;
                }

                if self.starts_with("@else") && matches!(self.peek_ahead(5), Some(' ' | '\t' | '\n' | '\r' | '{' | 'i')) {
                    self.bump(); // '@'
                    self.bump(); // 'e'
                    self.bump(); // 'l'
                    self.bump(); // 's'
                    self.bump(); // 'e'
                    tokens.push(Token {
                        kind: TokenKind::AtElse,
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                    continue;
                }

                if self.starts_with("@for") && matches!(self.peek_ahead(4), Some(' ' | '\t' | '\n' | '\r' | '(')) {
                    self.bump(); // '@'
                    self.bump(); // 'f'
                    self.bump(); // 'o'
                    self.bump(); // 'r'
                    self.control_flow_depth += 1;
                    self.in_control_header = true;
                    tokens.push(Token {
                        kind: TokenKind::AtFor,
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                    continue;
                }

                // If in control header or block delimiter
                if self.in_control_header {
                    if ch.is_whitespace() {
                        self.bump();
                        continue;
                    }
                    if ch == '(' {
                        self.bump();
                        tokens.push(Token {
                            kind: TokenKind::LParen,
                            span: self.current_span(start_cursor, start_line, start_col),
                        });
                        continue;
                    }
                    if ch == ')' {
                        self.bump();
                        tokens.push(Token {
                            kind: TokenKind::RParen,
                            span: self.current_span(start_cursor, start_line, start_col),
                        });
                        continue;
                    }
                    if ch == '{' {
                        self.bump();
                        self.in_control_header = false;
                        tokens.push(Token {
                            kind: TokenKind::LBrace,
                            span: self.current_span(start_cursor, start_line, start_col),
                        });
                        continue;
                    }
                    if ch == ';' {
                        self.bump();
                        tokens.push(Token {
                            kind: TokenKind::Semicolon,
                            span: self.current_span(start_cursor, start_line, start_col),
                        });
                        continue;
                    }
                }

                if self.control_flow_depth > 0 && ch == '}' {
                    self.bump();
                    self.control_flow_depth = self.control_flow_depth.saturating_sub(1);
                    tokens.push(Token {
                        kind: TokenKind::RBrace,
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                    continue;
                }

                // 3. Tags
                if ch == '<' {
                    if self.peek_ahead(1) == Some('/') {
                        // Closing tag: `</tag>`
                        self.bump(); // '<'
                        self.bump(); // '/'
                        let tag_start = self.cursor;
                        while let Some(c) = self.peek() {
                            if c == '>' || c.is_whitespace() {
                                break;
                            }
                            self.bump();
                        }
                        let tag_name = &self.source[tag_start..self.cursor];
                        while let Some(c) = self.peek() {
                            if c == '>' {
                                self.bump();
                                break;
                            }
                            self.bump();
                        }
                        tokens.push(Token {
                            kind: TokenKind::TagClose(tag_name),
                            span: self.current_span(start_cursor, start_line, start_col),
                        });
                        continue;
                    } else if let Some(next) = self.peek_ahead(1) {
                        if next.is_ascii_alphabetic() {
                            // Opening tag: `<tag`
                            self.bump(); // '<'
                            let tag_start = self.cursor;
                            while let Some(c) = self.peek() {
                                if c.is_whitespace() || c == '>' || c == '/' {
                                    break;
                                }
                                self.bump();
                            }
                            let tag_name = &self.source[tag_start..self.cursor];
                            inside_tag = true;
                            current_tag = tag_name;
                            tokens.push(Token {
                                kind: TokenKind::TagOpenStart(tag_name),
                                span: self.current_span(start_cursor, start_line, start_col),
                            });
                            continue;
                        }
                    }
                }

                // 4. Reactive interpolation: `{{ ... }}`
                if ch == '{' && self.peek_ahead(1) == Some('{') {
                    self.bump();
                    self.bump();
                    let expr_start = self.cursor;
                    let mut found_close = false;

                    while let Some(c) = self.peek() {
                        if c == '}' && self.peek_ahead(1) == Some('}') {
                            found_close = true;
                            break;
                        }
                        if c == '<' {
                            break;
                        }
                        self.bump();
                    }

                    let expr_str = self.source[expr_start..self.cursor].trim();
                    if found_close {
                        self.bump();
                        self.bump();
                    } else {
                        let span = self.current_span(start_cursor, start_line, start_col);
                        self.diagnostics.push(Diagnostic::error(
                            "TPL003",
                            "Unterminated interpolation binding, expected '}}'",
                            span,
                        ));
                    }

                    tokens.push(Token {
                        kind: TokenKind::Interpolation(expr_str),
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                    continue;
                }

                // 5. Plain text content
                let text_start = self.cursor;
                while let Some(c) = self.peek() {
                    if c == '<'
                        || (c == '{' && self.peek_ahead(1) == Some('{'))
                        || (self.control_flow_depth > 0 && c == '}')
                        || (self.in_control_header && (c == '(' || c == ')' || c == '{' || c == ';'))
                    {
                        break;
                    }
                    if c == '@' && (self.starts_with("@if") || self.starts_with("@else") || self.starts_with("@for")) {
                        break;
                    }
                    self.bump();
                }

                if self.cursor > text_start {
                    let text = &self.source[text_start..self.cursor];
                    tokens.push(Token {
                        kind: TokenKind::Text(text),
                        span: self.current_span(start_cursor, start_line, start_col),
                    });
                }
            }
        }

        let eof_span = Span::new(self.cursor, self.cursor, self.line, self.col);
        tokens.push(Token {
            kind: TokenKind::Eof,
            span: eof_span,
        });

        tokens
    }
}
