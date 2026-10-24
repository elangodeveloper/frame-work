//! Abstract Syntax Tree (AST) definitions for Jarvis templates.

use bumpalo::Bump;
use crate::diagnostics::Span;
use crate::expr::ExprAst;

/// Checks if a tag is a child component tag (contains hyphen or starts with uppercase).
pub fn is_component_tag(tag: &str) -> bool {
    tag.contains('-') || tag.chars().next().is_some_and(|c| c.is_ascii_uppercase())
}

/// Checks if a tag is an HTML void element that cannot have children or a closing tag.
pub fn is_void_tag(tag: &str) -> bool {
    matches!(
        tag.to_ascii_lowercase().as_str(),
        "area" | "base" | "br" | "col" | "embed" | "hr" | "img" | "input" | "link" | "meta" | "param" | "source" | "track" | "wbr"
    )
}

/// Checks if a tag contains raw text (no tags/interpolations parsed inside).
pub fn is_raw_text_tag(tag: &str) -> bool {
    matches!(tag.to_ascii_lowercase().as_str(), "script" | "style")
}

/// Root AST container for a Jarvis component template.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateAst {
    pub nodes: Vec<TemplateNode>,
    pub span: Span,
}

/// A node within a Jarvis template.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TemplateNode {
    Element(ElementNode),
    Text(TextNode),
    Interpolation(InterpolationNode),
    Comment(CommentNode),
    If(IfNode),
    For(ForNode),
}

impl TemplateNode {
    pub fn span(&self) -> Span {
        match self {
            Self::Element(e) => e.span,
            Self::Text(t) => t.span,
            Self::Interpolation(i) => i.span,
            Self::Comment(c) => c.span,
            Self::If(f) => f.span,
            Self::For(f) => f.span,
        }
    }
}

/// HTML element node or child component node.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ElementNode {
    pub tag: String,
    pub attributes: Vec<AttributeNode>,
    pub children: Vec<TemplateNode>,
    pub is_component: bool,
    pub is_void: bool,
    pub span: Span,
}

/// An attribute or binding on an HTML element.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttributeNode {
    pub name: String,
    pub value: Option<String>,
    pub expr: Option<ExprAst>,
    pub kind: AttributeKind,
    pub span: Span,
}

/// Classification of element attributes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttributeKind {
    /// Static HTML attribute: `class="p-4"`
    Static,
    /// Reactive property binding: `[disabled]="isLoading()"`
    PropertyBinding,
    /// Event binding: `(click)="save()"`
    EventBinding,
    /// Two-way binding: `[(value)]="name"`
    TwoWayBinding,
}

/// Plain text node within template markup.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TextNode {
    pub content: String,
    pub span: Span,
}

/// Reactive interpolation node: `{{ count() }}` or `{{ title }}`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InterpolationNode {
    pub expression: ExprAst,
    pub raw: String,
    pub span: Span,
}

/// HTML comment node: `<!-- comment -->`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommentNode {
    pub content: String,
    pub span: Span,
}

/// Control flow `@if` node.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IfNode {
    pub condition: ExprAst,
    pub raw_condition: String,
    pub then_branch: Vec<TemplateNode>,
    pub else_branch: Option<Vec<TemplateNode>>,
    pub span: Span,
}

/// Control flow `@for` node: `@for (item of items; track item.id)`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ForNode {
    pub item_var: String,
    pub items_expr: ExprAst,
    pub raw_items: String,
    pub track_expr: ExprAst,
    pub raw_track: String,
    pub body: Vec<TemplateNode>,
    pub span: Span,
}

// ============================================================================
// Arena-allocated AST for high performance (bumpalo)
// ============================================================================

/// Arena-allocated template node referencing memory in a `bumpalo::Bump`.
pub enum ArenaTemplateNode<'a> {
    Element {
        tag: &'a str,
        attributes: &'a [AttributeNode],
        children: &'a [ArenaTemplateNode<'a>],
        is_component: bool,
        is_void: bool,
        span: Span,
    },
    Text {
        content: &'a str,
        span: Span,
    },
    Interpolation {
        raw: &'a str,
        span: Span,
    },
    Comment {
        content: &'a str,
        span: Span,
    },
}

impl TemplateAst {
    /// Copies this AST into a Bumpalo arena.
    pub fn to_arena<'a>(&self, bump: &'a Bump) -> &'a [ArenaTemplateNode<'a>] {
        let mut arena_nodes = bumpalo::collections::Vec::new_in(bump);
        for node in &self.nodes {
            arena_nodes.push(Self::node_to_arena(node, bump));
        }
        arena_nodes.into_bump_slice()
    }

    fn node_to_arena<'a>(node: &TemplateNode, bump: &'a Bump) -> ArenaTemplateNode<'a> {
        match node {
            TemplateNode::Element(e) => {
                let tag = bump.alloc_str(&e.tag);
                let mut children = bumpalo::collections::Vec::new_in(bump);
                for child in &e.children {
                    children.push(Self::node_to_arena(child, bump));
                }
                let mut attrs = bumpalo::collections::Vec::new_in(bump);
                for attr in &e.attributes {
                    attrs.push(attr.clone());
                }
                ArenaTemplateNode::Element {
                    tag,
                    attributes: attrs.into_bump_slice(),
                    children: children.into_bump_slice(),
                    is_component: e.is_component,
                    is_void: e.is_void,
                    span: e.span,
                }
            }
            TemplateNode::Text(t) => ArenaTemplateNode::Text {
                content: bump.alloc_str(&t.content),
                span: t.span,
            },
            TemplateNode::Interpolation(i) => ArenaTemplateNode::Interpolation {
                raw: bump.alloc_str(&i.raw),
                span: i.span,
            },
            TemplateNode::Comment(c) => ArenaTemplateNode::Comment {
                content: bump.alloc_str(&c.content),
                span: c.span,
            },
            TemplateNode::If(f) => ArenaTemplateNode::Text {
                content: bump.alloc_str(&f.raw_condition),
                span: f.span,
            },
            TemplateNode::For(f) => ArenaTemplateNode::Text {
                content: bump.alloc_str(&f.raw_items),
                span: f.span,
            },
        }
    }
}
