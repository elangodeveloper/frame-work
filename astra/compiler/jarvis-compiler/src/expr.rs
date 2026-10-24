//! Safe Expression AST, Lexer, and Parser for Jarvis Templates.
use crate::diagnostics::{Diagnostic, Span};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExprAst {
    Literal(LiteralValue, Span),
    Identifier(String, Span),
    MemberAccess {
        object: Box<ExprAst>,
        property: String,
        span: Span,
    },
    Call {
        callee: Box<ExprAst>,
        arguments: Vec<ExprAst>,
        span: Span,
    },
    Binary {
        op: BinaryOp,
        left: Box<ExprAst>,
        right: Box<ExprAst>,
        span: Span,
    },
    Unary {
        op: UnaryOp,
        operand: Box<ExprAst>,
        span: Span,
    },
    Conditional {
        condition: Box<ExprAst>,
        consequent: Box<ExprAst>,
        alternate: Box<ExprAst>,
        span: Span,
    },
}

impl ExprAst {
    pub fn span(&self) -> Span {
        match self {
            Self::Literal(_, s) => *s,
            Self::Identifier(_, s) => *s,
            Self::MemberAccess { span, .. } => *span,
            Self::Call { span, .. } => *span,
            Self::Binary { span, .. } => *span,
            Self::Unary { span, .. } => *span,
            Self::Conditional { span, .. } => *span,
        }
    }

    pub fn to_js(&self) -> String {
        self.to_js_with_opts(false, false, &std::collections::HashSet::new())
    }

    pub fn to_js_with_opts(
        &self,
        is_callee: bool,
        is_member_object: bool,
        locals: &std::collections::HashSet<String>,
    ) -> String {
        match self {
            Self::Literal(lit, _) => lit.to_js(),
            Self::Identifier(name, _) => {
                if name == "$event" {
                    "$event".to_string()
                } else if name == "true"
                    || name == "false"
                    || name == "null"
                    || name == "undefined"
                    || locals.contains(name)
                {
                    name.clone()
                } else if is_callee || is_member_object {
                    format!("ctx.{}", name)
                } else {
                    format!("ctx.{}()", name)
                }
            }
            Self::MemberAccess { object, property, .. } => {
                let obj_js = object.to_js_with_opts(false, true, locals);
                format!("{}.{}", obj_js, property)
            }
            Self::Call { callee, arguments, .. } => {
                let callee_js = callee.to_js_with_opts(true, false, locals);
                let args: Vec<String> = arguments
                    .iter()
                    .map(|a| a.to_js_with_opts(false, false, locals))
                    .collect();
                format!("{}({})", callee_js, args.join(", "))
            }
            Self::Binary { op, left, right, .. } => {
                let l = left.to_js_with_opts(false, false, locals);
                let r = right.to_js_with_opts(false, false, locals);
                format!("({} {} {})", l, op.as_str(), r)
            }
            Self::Unary { op, operand, .. } => {
                let op_js = operand.to_js_with_opts(false, false, locals);
                format!("({}{})", op.as_str(), op_js)
            }
            Self::Conditional { condition, consequent, alternate, .. } => {
                let c = condition.to_js_with_opts(false, false, locals);
                let t = consequent.to_js_with_opts(false, false, locals);
                let a = alternate.to_js_with_opts(false, false, locals);
                format!("({} ? {} : {})", c, t, a)
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LiteralValue {
    Number(String),
    String(String),
    Boolean(bool),
    Null,
}

impl LiteralValue {
    pub fn to_js(&self) -> String {
        match self {
            Self::Number(n) => n.clone(),
            Self::String(s) => {
                let escaped = s.replace('\\', "\\\\").replace('\'', "\\'");
                format!("'{}'", escaped)
            }
            Self::Boolean(b) => if *b { "true".to_string() } else { "false".to_string() },
            Self::Null => "null".to_string(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOp {
    Add, Sub, Mul, Div, Eq, NotEq, StrictEq, StrictNotEq,
    Lt, Lte, Gt, Gte, And, Or,
}

impl BinaryOp {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Add => "+",
            Self::Sub => "-",
            Self::Mul => "*",
            Self::Div => "/",
            Self::Eq => "==",
            Self::NotEq => "!=",
            Self::StrictEq => "===",
            Self::StrictNotEq => "!==",
            Self::Lt => "<",
            Self::Lte => "<=",
            Self::Gt => ">",
            Self::Gte => ">=",
            Self::And => "&&",
            Self::Or => "||",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnaryOp {
    Not, Neg,
}

impl UnaryOp {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Not => "!",
            Self::Neg => "-",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ExprTokenKind {
    Identifier(String),
    Number(String),
    StringLiteral(String),
    Dot, Comma, Question, Colon, LParen, RParen,
    Bang, Plus, Minus, Star, Slash,
    EqEq, EqEqEq, BangEq, BangEqEq,
    Lt, LtEq, Gt, GtEq, AmpAmp, PipePipe, Eof,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ExprToken {
    kind: ExprTokenKind,
    span: Span,
}

pub struct ExpressionParser<'a> {
    _source: &'a str,
    tokens: Vec<ExprToken>,
    cursor: usize,
}

const DANGEROUS_IDENTIFIERS: &[&str] = &[
    "eval", "Function", "window", "document", "globalThis",
    "global", "process", "__proto__", "prototype", "constructor", "import",
];

impl<'a> ExpressionParser<'a> {
    pub fn parse_expression(source: &'a str, base_span: Span) -> Result<ExprAst, Diagnostic> {
        let mut p = Self::new(source, base_span)?;
        let ast = p.parse_ternary()?;
        if p.current().kind != ExprTokenKind::Eof {
            return Err(Diagnostic::error(
                "EXPR001",
                format!("Unexpected token in expression: {:?}", p.current().kind),
                p.current().span,
            ));
        }
        Ok(ast)
    }

    fn new(source: &'a str, base_span: Span) -> Result<Self, Diagnostic> {
        let tokens = Self::tokenize(source, base_span)?;
        Ok(Self { _source: source, tokens, cursor: 0 })
    }

    fn current(&self) -> &ExprToken {
        if self.cursor < self.tokens.len() {
            &self.tokens[self.cursor]
        } else {
            self.tokens.last().expect("tokens must not be empty")
        }
    }

    fn bump(&mut self) -> ExprToken {
        let tok = self.current().clone();
        if self.cursor < self.tokens.len() {
            self.cursor += 1;
        }
        tok
    }

    fn match_token(&mut self, kind: ExprTokenKind) -> bool {
        if self.current().kind == kind {
            self.bump();
            true
        } else {
            false
        }
    }

    fn parse_ternary(&mut self) -> Result<ExprAst, Diagnostic> {
        let cond = self.parse_or()?;
        if self.match_token(ExprTokenKind::Question) {
            let consequent = self.parse_ternary()?;
            if !self.match_token(ExprTokenKind::Colon) {
                return Err(Diagnostic::error("EXPR002", "Expected ':' in ternary expression", self.current().span));
            }
            let alternate = self.parse_ternary()?;
            let span = Span::new(cond.span().start, alternate.span().end, cond.span().line, cond.span().col);
            Ok(ExprAst::Conditional { condition: Box::new(cond), consequent: Box::new(consequent), alternate: Box::new(alternate), span })
        } else {
            Ok(cond)
        }
    }

    fn parse_or(&mut self) -> Result<ExprAst, Diagnostic> {
        let mut left = self.parse_and()?;
        while self.match_token(ExprTokenKind::PipePipe) {
            let right = self.parse_and()?;
            let span = Span::new(left.span().start, right.span().end, left.span().line, left.span().col);
            left = ExprAst::Binary { op: BinaryOp::Or, left: Box::new(left), right: Box::new(right), span };
        }
        Ok(left)
    }

    fn parse_and(&mut self) -> Result<ExprAst, Diagnostic> {
        let mut left = self.parse_equality()?;
        while self.match_token(ExprTokenKind::AmpAmp) {
            let right = self.parse_equality()?;
            let span = Span::new(left.span().start, right.span().end, left.span().line, left.span().col);
            left = ExprAst::Binary { op: BinaryOp::And, left: Box::new(left), right: Box::new(right), span };
        }
        Ok(left)
    }

    fn parse_equality(&mut self) -> Result<ExprAst, Diagnostic> {
        let mut left = self.parse_relational()?;
        loop {
            let op = if self.match_token(ExprTokenKind::EqEqEq) {
                Some(BinaryOp::StrictEq)
            } else if self.match_token(ExprTokenKind::BangEqEq) {
                Some(BinaryOp::StrictNotEq)
            } else if self.match_token(ExprTokenKind::EqEq) {
                Some(BinaryOp::Eq)
            } else if self.match_token(ExprTokenKind::BangEq) {
                Some(BinaryOp::NotEq)
            } else {
                None
            };

            if let Some(op) = op {
                let right = self.parse_relational()?;
                let span = Span::new(left.span().start, right.span().end, left.span().line, left.span().col);
                left = ExprAst::Binary { op, left: Box::new(left), right: Box::new(right), span };
            } else {
                break;
            }
        }
        Ok(left)
    }

    fn parse_relational(&mut self) -> Result<ExprAst, Diagnostic> {
        let mut left = self.parse_additive()?;
        loop {
            let op = if self.match_token(ExprTokenKind::LtEq) {
                Some(BinaryOp::Lte)
            } else if self.match_token(ExprTokenKind::Lt) {
                Some(BinaryOp::Lt)
            } else if self.match_token(ExprTokenKind::GtEq) {
                Some(BinaryOp::Gte)
            } else if self.match_token(ExprTokenKind::Gt) {
                Some(BinaryOp::Gt)
            } else {
                None
            };

            if let Some(op) = op {
                let right = self.parse_additive()?;
                let span = Span::new(left.span().start, right.span().end, left.span().line, left.span().col);
                left = ExprAst::Binary { op, left: Box::new(left), right: Box::new(right), span };
            } else {
                break;
            }
        }
        Ok(left)
    }

    fn parse_additive(&mut self) -> Result<ExprAst, Diagnostic> {
        let mut left = self.parse_multiplicative()?;
        loop {
            let op = if self.match_token(ExprTokenKind::Plus) {
                Some(BinaryOp::Add)
            } else if self.match_token(ExprTokenKind::Minus) {
                Some(BinaryOp::Sub)
            } else {
                None
            };

            if let Some(op) = op {
                let right = self.parse_multiplicative()?;
                let span = Span::new(left.span().start, right.span().end, left.span().line, left.span().col);
                left = ExprAst::Binary { op, left: Box::new(left), right: Box::new(right), span };
            } else {
                break;
            }
        }
        Ok(left)
    }

    fn parse_multiplicative(&mut self) -> Result<ExprAst, Diagnostic> {
        let mut left = self.parse_unary()?;
        loop {
            let op = if self.match_token(ExprTokenKind::Star) {
                Some(BinaryOp::Mul)
            } else if self.match_token(ExprTokenKind::Slash) {
                Some(BinaryOp::Div)
            } else {
                None
            };

            if let Some(op) = op {
                let right = self.parse_unary()?;
                let span = Span::new(left.span().start, right.span().end, left.span().line, left.span().col);
                left = ExprAst::Binary { op, left: Box::new(left), right: Box::new(right), span };
            } else {
                break;
            }
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<ExprAst, Diagnostic> {
        if self.match_token(ExprTokenKind::Bang) {
            let op_span = self.current().span;
            let operand = self.parse_unary()?;
            let span = Span::new(op_span.start, operand.span().end, op_span.line, op_span.col);
            Ok(ExprAst::Unary { op: UnaryOp::Not, operand: Box::new(operand), span })
        } else if self.match_token(ExprTokenKind::Minus) {
            let op_span = self.current().span;
            let operand = self.parse_unary()?;
            let span = Span::new(op_span.start, operand.span().end, op_span.line, op_span.col);
            Ok(ExprAst::Unary { op: UnaryOp::Neg, operand: Box::new(operand), span })
        } else {
            self.parse_call_or_member()
        }
    }

    fn parse_call_or_member(&mut self) -> Result<ExprAst, Diagnostic> {
        let mut expr = self.parse_primary()?;
        loop {
            if self.match_token(ExprTokenKind::Dot) {
                let prop_tok = self.bump();
                if let ExprTokenKind::Identifier(prop_name) = prop_tok.kind {
                    if DANGEROUS_IDENTIFIERS.contains(&prop_name.as_str()) {
                        return Err(Diagnostic::error(
                            "EXPR_SEC01",
                            format!("Access to dangerous property '{}' is prohibited in templates", prop_name),
                            prop_tok.span,
                        ));
                    }
                    let span = Span::new(expr.span().start, prop_tok.span.end, expr.span().line, expr.span().col);
                    expr = ExprAst::MemberAccess { object: Box::new(expr), property: prop_name, span };
                } else {
                    return Err(Diagnostic::error("EXPR003", "Expected property name after '.'", prop_tok.span));
                }
            } else if self.match_token(ExprTokenKind::LParen) {
                let mut args = Vec::new();
                if self.current().kind != ExprTokenKind::RParen {
                    loop {
                        args.push(self.parse_ternary()?);
                        if !self.match_token(ExprTokenKind::Comma) {
                            break;
                        }
                    }
                }
                let close_tok = self.bump();
                if close_tok.kind != ExprTokenKind::RParen {
                    return Err(Diagnostic::error("EXPR004", "Expected closing ')' in function call", close_tok.span));
                }
                let span = Span::new(expr.span().start, close_tok.span.end, expr.span().line, expr.span().col);
                expr = ExprAst::Call { callee: Box::new(expr), arguments: args, span };
            } else {
                break;
            }
        }
        Ok(expr)
    }

    fn parse_primary(&mut self) -> Result<ExprAst, Diagnostic> {
        let tok = self.bump();
        match tok.kind {
            ExprTokenKind::Number(num) => Ok(ExprAst::Literal(LiteralValue::Number(num), tok.span)),
            ExprTokenKind::StringLiteral(s) => Ok(ExprAst::Literal(LiteralValue::String(s), tok.span)),
            ExprTokenKind::Identifier(name) => {
                if DANGEROUS_IDENTIFIERS.contains(&name.as_str()) {
                    return Err(Diagnostic::error(
                        "EXPR_SEC02",
                        format!("Access to identifier '{}' is prohibited in templates", name),
                        tok.span,
                    ));
                }
                if name == "true" {
                    Ok(ExprAst::Literal(LiteralValue::Boolean(true), tok.span))
                } else if name == "false" {
                    Ok(ExprAst::Literal(LiteralValue::Boolean(false), tok.span))
                } else if name == "null" {
                    Ok(ExprAst::Literal(LiteralValue::Null, tok.span))
                } else {
                    Ok(ExprAst::Identifier(name, tok.span))
                }
            }
            ExprTokenKind::LParen => {
                let expr = self.parse_ternary()?;
                let close = self.bump();
                if close.kind != ExprTokenKind::RParen {
                    return Err(Diagnostic::error("EXPR005", "Expected closing ')'", close.span));
                }
                Ok(expr)
            }
            _ => Err(Diagnostic::error("EXPR006", format!("Unexpected token: {:?}", tok.kind), tok.span)),
        }
    }

    fn tokenize(source: &'a str, base_span: Span) -> Result<Vec<ExprToken>, Diagnostic> {
        let mut tokens = Vec::new();
        let chars: Vec<char> = source.chars().collect();
        let len = chars.len();
        let mut i = 0;

        while i < len {
            let ch = chars[i];
            if ch.is_whitespace() {
                i += 1;
                continue;
            }

            let start = base_span.start + i;
            let line = base_span.line;
            let col = base_span.col + i;

            if ch == '.' {
                tokens.push(ExprToken { kind: ExprTokenKind::Dot, span: Span::new(start, start + 1, line, col) });
                i += 1;
            } else if ch == ',' {
                tokens.push(ExprToken { kind: ExprTokenKind::Comma, span: Span::new(start, start + 1, line, col) });
                i += 1;
            } else if ch == '?' {
                tokens.push(ExprToken { kind: ExprTokenKind::Question, span: Span::new(start, start + 1, line, col) });
                i += 1;
            } else if ch == ':' {
                tokens.push(ExprToken { kind: ExprTokenKind::Colon, span: Span::new(start, start + 1, line, col) });
                i += 1;
            } else if ch == '(' {
                tokens.push(ExprToken { kind: ExprTokenKind::LParen, span: Span::new(start, start + 1, line, col) });
                i += 1;
            } else if ch == ')' {
                tokens.push(ExprToken { kind: ExprTokenKind::RParen, span: Span::new(start, start + 1, line, col) });
                i += 1;
            } else if ch == '+' {
                tokens.push(ExprToken { kind: ExprTokenKind::Plus, span: Span::new(start, start + 1, line, col) });
                i += 1;
            } else if ch == '-' {
                tokens.push(ExprToken { kind: ExprTokenKind::Minus, span: Span::new(start, start + 1, line, col) });
                i += 1;
            } else if ch == '*' {
                tokens.push(ExprToken { kind: ExprTokenKind::Star, span: Span::new(start, start + 1, line, col) });
                i += 1;
            } else if ch == '/' {
                tokens.push(ExprToken { kind: ExprTokenKind::Slash, span: Span::new(start, start + 1, line, col) });
                i += 1;
            } else if ch == '&' {
                if i + 1 < len && chars[i + 1] == '&' {
                    tokens.push(ExprToken { kind: ExprTokenKind::AmpAmp, span: Span::new(start, start + 2, line, col) });
                    i += 2;
                } else {
                    return Err(Diagnostic::error("EXPR_TOK01", "Unexpected '&', did you mean '&&'?", Span::new(start, start + 1, line, col)));
                }
            } else if ch == '|' {
                if i + 1 < len && chars[i + 1] == '|' {
                    tokens.push(ExprToken { kind: ExprTokenKind::PipePipe, span: Span::new(start, start + 2, line, col) });
                    i += 2;
                } else {
                    return Err(Diagnostic::error("EXPR_TOK02", "Unexpected '|', did you mean '||'?", Span::new(start, start + 1, line, col)));
                }
            } else if ch == '=' {
                if i + 2 < len && chars[i + 1] == '=' && chars[i + 2] == '=' {
                    tokens.push(ExprToken { kind: ExprTokenKind::EqEqEq, span: Span::new(start, start + 3, line, col) });
                    i += 3;
                } else if i + 1 < len && chars[i + 1] == '=' {
                    tokens.push(ExprToken { kind: ExprTokenKind::EqEq, span: Span::new(start, start + 2, line, col) });
                    i += 2;
                } else {
                    return Err(Diagnostic::error("EXPR_TOK03", "Assignments are prohibited in template expressions", Span::new(start, start + 1, line, col)));
                }
            } else if ch == '!' {
                if i + 2 < len && chars[i + 1] == '=' && chars[i + 2] == '=' {
                    tokens.push(ExprToken { kind: ExprTokenKind::BangEqEq, span: Span::new(start, start + 3, line, col) });
                    i += 3;
                } else if i + 1 < len && chars[i + 1] == '=' {
                    tokens.push(ExprToken { kind: ExprTokenKind::BangEq, span: Span::new(start, start + 2, line, col) });
                    i += 2;
                } else {
                    tokens.push(ExprToken { kind: ExprTokenKind::Bang, span: Span::new(start, start + 1, line, col) });
                    i += 1;
                }
            } else if ch == '<' {
                if i + 1 < len && chars[i + 1] == '=' {
                    tokens.push(ExprToken { kind: ExprTokenKind::LtEq, span: Span::new(start, start + 2, line, col) });
                    i += 2;
                } else {
                    tokens.push(ExprToken { kind: ExprTokenKind::Lt, span: Span::new(start, start + 1, line, col) });
                    i += 1;
                }
            } else if ch == '>' {
                if i + 1 < len && chars[i + 1] == '=' {
                    tokens.push(ExprToken { kind: ExprTokenKind::GtEq, span: Span::new(start, start + 2, line, col) });
                    i += 2;
                } else {
                    tokens.push(ExprToken { kind: ExprTokenKind::Gt, span: Span::new(start, start + 1, line, col) });
                    i += 1;
                }
            } else if ch == '\'' || ch == '"' {
                let quote = ch;
                let str_start = i;
                i += 1;
                let mut buf = String::new();
                while i < len && chars[i] != quote {
                    if chars[i] == '\\' && i + 1 < len {
                        i += 1;
                        buf.push(chars[i]);
                    } else {
                        buf.push(chars[i]);
                    }
                    i += 1;
                }
                if i >= len {
                    return Err(Diagnostic::error("EXPR_TOK04", "Unterminated string literal", Span::new(start, base_span.start + i, line, col)));
                }
                i += 1; // consume quote
                let span = Span::new(base_span.start + str_start, base_span.start + i, line, col);
                tokens.push(ExprToken { kind: ExprTokenKind::StringLiteral(buf), span });
            } else if ch.is_ascii_digit() {
                let num_start = i;
                let mut has_dot = false;
                while i < len && (chars[i].is_ascii_digit() || (chars[i] == '.' && !has_dot)) {
                    if chars[i] == '.' {
                        if i + 1 < len && chars[i + 1].is_ascii_digit() {
                            has_dot = true;
                        } else {
                            break;
                        }
                    }
                    i += 1;
                }
                let raw: String = chars[num_start..i].iter().collect();
                let span = Span::new(base_span.start + num_start, base_span.start + i, line, col);
                tokens.push(ExprToken { kind: ExprTokenKind::Number(raw), span });
            } else if ch.is_ascii_alphabetic() || ch == '_' || ch == '$' {
                let id_start = i;
                while i < len && (chars[i].is_ascii_alphanumeric() || chars[i] == '_' || chars[i] == '$') {
                    i += 1;
                }
                let raw: String = chars[id_start..i].iter().collect();
                let span = Span::new(base_span.start + id_start, base_span.start + i, line, col);
                tokens.push(ExprToken { kind: ExprTokenKind::Identifier(raw), span });
            } else {
                return Err(Diagnostic::error(
                    "EXPR_TOK05",
                    format!("Unexpected character '{}' in expression", ch),
                    Span::new(start, start + 1, line, col),
                ));
            }
        }

        let end_idx = base_span.start + len;
        tokens.push(ExprToken {
            kind: ExprTokenKind::Eof,
            span: Span::new(end_idx, end_idx, base_span.line, base_span.col + len),
        });
        Ok(tokens)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_identifier() {
        let span = Span::new(0, 5, 1, 1);
        let ast = ExpressionParser::parse_expression("title", span).unwrap();
        assert_eq!(ast.to_js(), "ctx.title()");
    }

    #[test]
    fn test_parse_function_call() {
        let span = Span::new(0, 7, 1, 1);
        let ast = ExpressionParser::parse_expression("count()", span).unwrap();
        assert_eq!(ast.to_js(), "ctx.count()");
    }

    #[test]
    fn test_parse_binary_arithmetic() {
        let span = Span::new(0, 9, 1, 1);
        let ast = ExpressionParser::parse_expression("x + 10 * y", span).unwrap();
        assert_eq!(ast.to_js(), "(ctx.x() + (10 * ctx.y()))");
    }

    #[test]
    fn test_parse_ternary_conditional() {
        let span = Span::new(0, 24, 1, 1);
        let ast = ExpressionParser::parse_expression("isValid ? 'OK' : 'Error'", span).unwrap();
        assert_eq!(ast.to_js(), "(ctx.isValid() ? 'OK' : 'Error')");
    }

    #[test]
    fn test_parse_event_identifier() {
        let span = Span::new(0, 15, 1, 1);
        let ast = ExpressionParser::parse_expression("handle($event)", span).unwrap();
        assert_eq!(ast.to_js(), "ctx.handle($event)");
    }

    #[test]
    fn test_dangerous_property_access_blocked() {
        let span = Span::new(0, 16, 1, 1);
        let err = ExpressionParser::parse_expression("user.__proto__", span).unwrap_err();
        assert_eq!(err.code, "EXPR_SEC01");
    }

    #[test]
    fn test_dangerous_global_blocked() {
        let span = Span::new(0, 15, 1, 1);
        let err = ExpressionParser::parse_expression("window.alert(1)", span).unwrap_err();
        assert_eq!(err.code, "EXPR_SEC02");
    }

    #[test]
    fn test_assignment_blocked() {
        let span = Span::new(0, 7, 1, 1);
        let err = ExpressionParser::parse_expression("x = 100", span).unwrap_err();
        assert_eq!(err.code, "EXPR_TOK03");
    }
}