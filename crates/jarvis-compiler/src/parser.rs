//! Parser building structured Template AST with error recovery and tag interning.

use lasso::Rodeo;
use crate::ast::*;
use crate::diagnostics::{Diagnostic, Span};
use crate::expr::{ExprAst, ExpressionParser, LiteralValue};
use crate::lexer::{Token, TokenKind};

/// Decodes standard HTML entities in plain text nodes.
pub fn decode_html_entities(input: &str) -> String {
    if !input.contains('&') {
        return input.to_string();
    }
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '&' {
            let mut entity = String::new();
            while let Some(&c) = chars.peek() {
                if c == ';' {
                    chars.next();
                    break;
                }
                if c.is_whitespace() || c == '&' || entity.len() > 10 {
                    break;
                }
                entity.push(chars.next().unwrap());
            }
            match entity.as_str() {
                "amp" => out.push('&'),
                "lt" => out.push('<'),
                "gt" => out.push('>'),
                "quot" => out.push('"'),
                "apos" => out.push('\''),
                "nbsp" => out.push('\u{00A0}'),
                _ => {
                    if let Some(stripped) = entity.strip_prefix('#') {
                        if let Some(hex) = stripped.strip_prefix('x').or_else(|| stripped.strip_prefix('X')) {
                            if let Ok(code) = u32::from_str_radix(hex, 16) {
                                if let Some(c) = char::from_u32(code) {
                                    out.push(c);
                                    continue;
                                }
                            }
                        } else if let Ok(code) = stripped.parse::<u32>() {
                            if let Some(c) = char::from_u32(code) {
                                out.push(c);
                                continue;
                            }
                        }
                    }
                    out.push('&');
                    out.push_str(&entity);
                }
            }
        } else {
            out.push(ch);
        }
    }
    out
}

pub struct Parser<'a> {
    tokens: Vec<Token<'a>>,
    cursor: usize,
    pub diagnostics: Vec<Diagnostic>,
    pub interner: Rodeo,
}

impl<'a> Parser<'a> {
    pub fn new(tokens: Vec<Token<'a>>) -> Self {
        Self {
            tokens,
            cursor: 0,
            diagnostics: Vec::new(),
            interner: Rodeo::default(),
        }
    }

    pub fn with_diagnostics(tokens: Vec<Token<'a>>, initial_diagnostics: Vec<Diagnostic>) -> Self {
        Self {
            tokens,
            cursor: 0,
            diagnostics: initial_diagnostics,
            interner: Rodeo::default(),
        }
    }

    fn current(&self) -> &Token<'a> {
        if self.cursor < self.tokens.len() {
            &self.tokens[self.cursor]
        } else {
            self.tokens.last().expect("token stream must not be empty")
        }
    }

    fn bump(&mut self) -> Token<'a> {
        let tok = *self.current();
        if self.cursor < self.tokens.len() {
            self.cursor += 1;
        }
        tok
    }

    pub fn parse(&mut self) -> Result<TemplateAst, Diagnostic> {
        let ast = self.parse_all();
        if let Some(first_err) = self.diagnostics.first() {
            Err(first_err.clone())
        } else {
            Ok(ast)
        }
    }

    pub fn parse_all(&mut self) -> TemplateAst {
        let start_span = self.current().span;
        let mut nodes = Vec::new();

        while self.current().kind != TokenKind::Eof {
            if let Some(node) = self.parse_node() {
                nodes.push(node);
            }
        }

        let end_span = self.current().span;
        let span = Span::new(
            start_span.start,
            end_span.end,
            start_span.line,
            start_span.col,
        );

        TemplateAst { nodes, span }
    }

    fn parse_node(&mut self) -> Option<TemplateNode> {
        let tok = *self.current();

        match tok.kind {
            TokenKind::TagOpenStart(tag_name) => {
                let elem = self.parse_element(tag_name, tok.span);
                Some(TemplateNode::Element(elem))
            }
            TokenKind::Text(content) => {
                self.bump();
                let decoded = decode_html_entities(content);
                if decoded.trim().is_empty() {
                    None
                } else {
                    Some(TemplateNode::Text(TextNode {
                        content: decoded,
                        span: tok.span,
                    }))
                }
            }
            TokenKind::RawText(content) => {
                self.bump();
                Some(TemplateNode::Text(TextNode {
                    content: content.to_string(),
                    span: tok.span,
                }))
            }
            TokenKind::Comment(content) => {
                self.bump();
                Some(TemplateNode::Comment(CommentNode {
                    content: content.to_string(),
                    span: tok.span,
                }))
            }
            TokenKind::Interpolation(raw_expr) => {
                self.bump();
                let expr_ast = match ExpressionParser::parse_expression(raw_expr, tok.span) {
                    Ok(ast) => ast,
                    Err(diag) => {
                        self.diagnostics.push(diag);
                        ExprAst::Literal(LiteralValue::Null, tok.span)
                    }
                };
                Some(TemplateNode::Interpolation(InterpolationNode {
                    expression: expr_ast,
                    raw: raw_expr.to_string(),
                    span: tok.span,
                }))
            }
            TokenKind::AtIf => Some(self.parse_if_block(tok.span)),
            TokenKind::AtFor => Some(self.parse_for_block(tok.span)),
            TokenKind::TagClose(unmatched_tag) => {
                self.diagnostics.push(Diagnostic::error(
                    "TPL004",
                    format!("Unexpected closing tag '</{}>' without matching opening tag", unmatched_tag),
                    tok.span,
                ));
                self.bump(); // recover by skipping unexpected closing tag
                None
            }
            TokenKind::Eof => None,
            _ => {
                self.bump();
                None
            }
        }
    }

    fn parse_element(&mut self, tag: &'a str, start_span: Span) -> ElementNode {
        self.bump(); // consume TagOpenStart

        let tag_spur = self.interner.get_or_intern(tag);
        let tag_name = tag.to_string();
        let is_component = is_component_tag(tag);
        let is_void = is_void_tag(tag);

        let mut attributes = Vec::new();

        // Parse attributes until `>` or `/>`
        while self.current().kind != TokenKind::TagOpenEnd
            && self.current().kind != TokenKind::TagSelfClose
            && self.current().kind != TokenKind::Eof
        {
            if let TokenKind::AttributeName(name) = self.current().kind {
                let attr_span = self.current().span;
                self.bump();

                let mut value = None;
                if self.current().kind == TokenKind::Equals {
                    self.bump();
                    if let TokenKind::AttributeValue(val) = self.current().kind {
                        self.bump();
                        value = Some(val.to_string());
                    }
                }

                let kind = if name.starts_with("[(") && name.ends_with(")]") {
                    AttributeKind::TwoWayBinding
                } else if name.starts_with('[') && name.ends_with(']') {
                    AttributeKind::PropertyBinding
                } else if name.starts_with('(') && name.ends_with(')') {
                    AttributeKind::EventBinding
                } else {
                    AttributeKind::Static
                };

                let expr = if let Some(ref val) = value {
                    match kind {
                        AttributeKind::PropertyBinding | AttributeKind::TwoWayBinding | AttributeKind::EventBinding => {
                            match ExpressionParser::parse_expression(val, attr_span) {
                                Ok(ast) => Some(ast),
                                Err(diag) => {
                                    self.diagnostics.push(diag);
                                    None
                                }
                            }
                        }
                        _ => None,
                    }
                } else {
                    None
                };

                attributes.push(AttributeNode {
                    name: name.to_string(),
                    value,
                    expr,
                    kind,
                    span: attr_span,
                });
            } else {
                self.bump();
            }
        }

        // Self-closing: `<tag />`
        if self.current().kind == TokenKind::TagSelfClose {
            let close_tok = self.bump();
            return ElementNode {
                tag: tag_name,
                attributes,
                children: Vec::new(),
                is_component,
                is_void,
                span: Span::new(
                    start_span.start,
                    close_tok.span.end,
                    start_span.line,
                    start_span.col,
                ),
            };
        }

        // Consume `>`
        if self.current().kind == TokenKind::TagOpenEnd {
            self.bump();
        }

        // Void elements: <input>, <img>, <br>, <hr> have no children and no closing tag
        if is_void {
            return ElementNode {
                tag: tag_name,
                attributes,
                children: Vec::new(),
                is_component,
                is_void,
                span: Span::new(
                    start_span.start,
                    self.current().span.start,
                    start_span.line,
                    start_span.col,
                ),
            };
        }

        // Parse children
        let mut children = Vec::new();
        while self.current().kind != TokenKind::Eof {
            if let TokenKind::TagClose(close_tag) = self.current().kind {
                let close_spur = self.interner.get_or_intern(close_tag);
                if close_spur == tag_spur {
                    let end_tok = self.bump();
                    return ElementNode {
                        tag: tag_name,
                        attributes,
                        children,
                        is_component,
                        is_void,
                        span: Span::new(
                            start_span.start,
                            end_tok.span.end,
                            start_span.line,
                            start_span.col,
                        ),
                    };
                } else {
                    // Mismatched closing tag (TPL005 error recovery)
                    let span = self.current().span;
                    self.diagnostics.push(
                        Diagnostic::error(
                            "TPL005",
                            format!("Mismatched closing tag: expected '</{}>', found '</{}>'", tag, close_tag),
                            span,
                        )
                        .with_suggestion(format!("Change '</{}>' to '</{}>'", close_tag, tag)),
                    );
                    self.bump(); // skip mismatched tag and recover by closing this element
                    return ElementNode {
                        tag: tag_name,
                        attributes,
                        children,
                        is_component,
                        is_void,
                        span: Span::new(
                            start_span.start,
                            span.end,
                            start_span.line,
                            start_span.col,
                        ),
                    };
                }
            }

            if let Some(child) = self.parse_node() {
                children.push(child);
            }
        }

        // Unclosed element at EOF (TPL006 error recovery)
        let eof_span = self.current().span;
        self.diagnostics.push(Diagnostic::error(
            "TPL006",
            format!("Unclosed element '<{}>', expected closing tag '</{}>'", tag, tag),
            eof_span,
        ));

        ElementNode {
            tag: tag_name,
            attributes,
            children,
            is_component,
            is_void,
            span: Span::new(
                start_span.start,
                eof_span.end,
                start_span.line,
                start_span.col,
            ),
        }
    }

    fn skip_whitespace(&mut self) {
        while self.cursor < self.tokens.len() {
            if let TokenKind::Text(t) = self.current().kind {
                if t.trim().is_empty() {
                    self.bump();
                    continue;
                }
            }
            break;
        }
    }

    fn parse_if_block(&mut self, start_span: Span) -> TemplateNode {
        self.bump(); // consume AtIf
        self.skip_whitespace();

        // Parse condition inside (...)
        let mut cond_str = String::new();
        let cond_span = self.current().span;
        if self.current().kind == TokenKind::LParen {
            self.bump();
            while self.current().kind != TokenKind::RParen && self.current().kind != TokenKind::Eof {
                if let TokenKind::Text(s) = self.current().kind {
                    cond_str.push_str(s);
                }
                self.bump();
            }
            if self.current().kind == TokenKind::RParen {
                self.bump();
            }
        }

        let cond_ast = match ExpressionParser::parse_expression(&cond_str, cond_span) {
            Ok(ast) => ast,
            Err(diag) => {
                self.diagnostics.push(diag);
                ExprAst::Literal(LiteralValue::Boolean(true), cond_span)
            }
        };

        self.skip_whitespace();
        // Parse then-branch inside {...}
        let mut then_branch = Vec::new();
        if self.current().kind == TokenKind::LBrace {
            self.bump();
            while self.current().kind != TokenKind::RBrace && self.current().kind != TokenKind::Eof {
                if let Some(node) = self.parse_node() {
                    then_branch.push(node);
                }
            }
            if self.current().kind == TokenKind::RBrace {
                self.bump();
            }
        }

        // Parse optional @else branch
        let mut else_branch = None;
        self.skip_whitespace();
        if self.current().kind == TokenKind::AtElse {
            self.bump();
            self.skip_whitespace();
            let mut else_nodes = Vec::new();
            if self.current().kind == TokenKind::LBrace {
                self.bump();
                while self.current().kind != TokenKind::RBrace && self.current().kind != TokenKind::Eof {
                    if let Some(node) = self.parse_node() {
                        else_nodes.push(node);
                    }
                }
                if self.current().kind == TokenKind::RBrace {
                    self.bump();
                }
            }
            else_branch = Some(else_nodes);
        }

        let end_span = self.current().span;
        TemplateNode::If(IfNode {
            condition: cond_ast,
            raw_condition: cond_str,
            then_branch,
            else_branch,
            span: Span::new(start_span.start, end_span.end, start_span.line, start_span.col),
        })
    }

    fn parse_for_block(&mut self, start_span: Span) -> TemplateNode {
        self.bump(); // consume AtFor

        // Format: @for (item of items; track item.id)
        let mut header_str = String::new();
        let header_span = self.current().span;
        if self.current().kind == TokenKind::LParen {
            self.bump();
            while self.current().kind != TokenKind::RParen && self.current().kind != TokenKind::Eof {
                match self.current().kind {
                    TokenKind::Text(s) => header_str.push_str(s),
                    TokenKind::Semicolon => header_str.push(';'),
                    _ => {}
                }
                self.bump();
            }
            if self.current().kind == TokenKind::RParen {
                self.bump();
            }
        }

        // Split item of items; track item.id
        let parts: Vec<&str> = header_str.split(';').collect();
        let loop_part = parts.first().copied().unwrap_or("").trim();
        let track_part = parts.get(1).copied().unwrap_or("").trim();

        let (item_var, items_raw) = if let Some(idx) = loop_part.find(" of ") {
            (loop_part[..idx].trim().to_string(), loop_part[idx + 4..].trim().to_string())
        } else {
            ("item".to_string(), "items".to_string())
        };

        let track_raw = if let Some(stripped) = track_part.strip_prefix("track ") {
            stripped.trim().to_string()
        } else {
            "item".to_string()
        };

        let items_ast = ExpressionParser::parse_expression(&items_raw, header_span)
            .unwrap_or_else(|_| ExprAst::Identifier(items_raw.clone(), header_span));
        let track_ast = ExpressionParser::parse_expression(&track_raw, header_span)
            .unwrap_or_else(|_| ExprAst::Identifier(track_raw.clone(), header_span));

        self.skip_whitespace();
        // Parse body {...}
        let mut body = Vec::new();
        if self.current().kind == TokenKind::LBrace {
            self.bump();
            while self.current().kind != TokenKind::RBrace && self.current().kind != TokenKind::Eof {
                if let Some(node) = self.parse_node() {
                    body.push(node);
                }
            }
            if self.current().kind == TokenKind::RBrace {
                self.bump();
            }
        }

        let end_span = self.current().span;
        TemplateNode::For(ForNode {
            item_var,
            items_expr: items_ast,
            raw_items: items_raw,
            track_expr: track_ast,
            raw_track: track_raw,
            body,
            span: Span::new(start_span.start, end_span.end, start_span.line, start_span.col),
        })
    }
}
