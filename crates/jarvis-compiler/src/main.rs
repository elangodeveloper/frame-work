//! CLI binary for jarvis-compiler.

use jarvis_compiler::{
    compile_template, compile_template_to_ir, compile_template_with_diagnostics,
    diff_ir, DiagnosticSeverity, TemplateCache, TemplateDiff, compute_unit_cache_key,
    COMPILER_VERSION,
};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{self, BufRead};
use std::path::PathBuf;
use std::process;

#[derive(Deserialize)]
struct WorkerRequest {
    #[serde(default)]
    command: Option<String>,
    source: String,
    old_source: Option<String>,
    #[serde(default)]
    _file_path: Option<String>,
    #[serde(default)]
    unit_type: Option<String>,
    #[serde(default)]
    config_hash: Option<String>,
    #[serde(default)]
    cache_dir: Option<String>,
}

#[derive(Serialize)]
struct DiagnosticItemOut {
    code: String,
    severity: String,
    message: String,
    line: usize,
    col: usize,
    start: usize,
    end: usize,
    suggestion: Option<String>,
}

#[derive(Serialize)]
struct WorkerResponse {
    success: bool,
    code: Option<String>,
    diagnostics: Vec<DiagnosticItemOut>,
    #[serde(skip_serializing_if = "Option::is_none")]
    diff: Option<TemplateDiff>,
    cached: bool,
}

fn run_worker_loop() {
    let stdin = io::stdin();
    let mut lines = stdin.lock().lines();
    let mut disk_cache: Option<TemplateCache> = None;
    let mut last_cache_dir: Option<String> = None;

    while let Some(Ok(line)) = lines.next() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let req: Result<WorkerRequest, _> = serde_json::from_str(trimmed);
        match req {
            Ok(req) => {
                // Initialize or update disk cache if requested
                if let Some(ref dir) = req.cache_dir {
                    if last_cache_dir.as_ref() != Some(dir) {
                        disk_cache = Some(TemplateCache::with_disk_dir(PathBuf::from(dir)));
                        last_cache_dir = Some(dir.clone());
                    }
                }

                let command = req.command.unwrap_or_else(|| "compile".to_string());
                let config_hash = req.config_hash.unwrap_or_else(|| "default".to_string());
                let unit_type = req.unit_type.unwrap_or_else(|| "template".to_string());

                // Check cache if cache_dir is set
                let cache_key = compute_unit_cache_key(
                    COMPILER_VERSION,
                    &config_hash,
                    &unit_type,
                    &req.source,
                );

                if let Some(ref cache) = disk_cache {
                    if let Some(cached_code) = cache.get(&cache_key) {
                        let res = WorkerResponse {
                            success: true,
                            code: Some(cached_code),
                            diagnostics: Vec::new(),
                            diff: None,
                            cached: true,
                        };
                        if let Ok(json) = serde_json::to_string(&res) {
                            println!("{}", json);
                            continue;
                        }
                    }
                }

                if command == "diff" {
                    if let Some(ref old_src) = req.old_source {
                        let old_ir_res = compile_template_to_ir(old_src);
                        let new_ir_res = compile_template_to_ir(&req.source);

                        match (old_ir_res, new_ir_res) {
                            (Ok((old_ir, _)), Ok((new_ir, new_code))) => {
                                let diff = diff_ir(&old_ir, &new_ir);
                                if let Some(ref cache) = disk_cache {
                                    cache.insert(cache_key, new_code.clone());
                                }
                                let res = WorkerResponse {
                                    success: true,
                                    code: Some(new_code),
                                    diagnostics: Vec::new(),
                                    diff: Some(diff),
                                    cached: false,
                                };
                                if let Ok(json) = serde_json::to_string(&res) {
                                    println!("{}", json);
                                }
                                continue;
                            }
                            _ => {
                                // Fall through to standard compilation if diffing fails
                            }
                        }
                    }
                }

                // Standard template compilation
                let (code_opt, diags) = compile_template_with_diagnostics(&req.source);
                let has_err = diags.iter().any(|d| d.severity == DiagnosticSeverity::Error);

                let diag_outs: Vec<DiagnosticItemOut> = diags
                    .into_iter()
                    .map(|d| DiagnosticItemOut {
                        code: d.code.to_string(),
                        severity: format!("{:?}", d.severity),
                        message: d.message,
                        line: d.span.line,
                        col: d.span.col,
                        start: d.span.start,
                        end: d.span.end,
                        suggestion: d.suggestion,
                    })
                    .collect();

                let diff = if !has_err {
                    if let Some(old_src) = req.old_source {
                        let old_ir_res = compile_template_to_ir(&old_src);
                        let new_ir_res = compile_template_to_ir(&req.source);
                        match (old_ir_res, new_ir_res) {
                            (Ok((old_ir, _)), Ok((new_ir, _))) => Some(diff_ir(&old_ir, &new_ir)),
                            _ => Some(TemplateDiff::TemplateSwap {
                                reason: "Could not compile both templates for IR diff".to_string(),
                            }),
                        }
                    } else {
                        None
                    }
                } else {
                    None
                };

                if !has_err {
                    if let Some(ref code) = code_opt {
                        if let Some(ref cache) = disk_cache {
                            cache.insert(cache_key, code.clone());
                        }
                    }
                }

                let res = WorkerResponse {
                    success: !has_err,
                    code: code_opt,
                    diagnostics: diag_outs,
                    diff,
                    cached: false,
                };

                if let Ok(json) = serde_json::to_string(&res) {
                    println!("{}", json);
                }
            }
            Err(e) => {
                let res = WorkerResponse {
                    success: false,
                    code: None,
                    diagnostics: vec![DiagnosticItemOut {
                        code: "IPC_JSON_ERR".to_string(),
                        severity: "Error".to_string(),
                        message: format!("Invalid JSON request: {}", e),
                        line: 1,
                        col: 1,
                        start: 0,
                        end: 0,
                        suggestion: None,
                    }],
                    diff: None,
                    cached: false,
                };
                if let Ok(json) = serde_json::to_string(&res) {
                    println!("{}", json);
                }
            }
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();

    if args.iter().any(|a| a == "--worker") {
        run_worker_loop();
        return;
    }

    let mut emit_json = false;
    let mut template_str = None;
    let mut file_path = None;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--json" => emit_json = true,
            "--file" => {
                i += 1;
                if i < args.len() {
                    file_path = Some(args[i].clone());
                }
            }
            "--help" | "-h" => {
                println!("Jarvis Template Compiler 0.1.0");
                println!("Usage: jarvis-compiler [options] [\"<template>\"]");
                println!();
                println!("Options:");
                println!("  --worker        Start persistent compiler daemon (JSON-RPC over stdin/stdout)");
                println!("  --file <path>   Compile template from file");
                println!("  --json          Emit machine-readable JSON");
                println!("  -h, --help      Display this help message");
                return;
            }
            arg => {
                if !arg.starts_with('-') && template_str.is_none() {
                    template_str = Some(arg.to_string());
                }
            }
        }
        i += 1;
    }

    let source = if let Some(path) = file_path {
        match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(err) => {
                eprintln!("Error reading file '{}': {}", path, err);
                process::exit(1);
            }
        }
    } else if let Some(tpl) = template_str {
        tpl
    } else {
        eprintln!("Error: No template provided. Run with --help for usage.");
        process::exit(1);
    };

    if emit_json {
        let (code_opt, diags) = compile_template_with_diagnostics(&source);
        let has_err = diags.iter().any(|d| d.severity == DiagnosticSeverity::Error);
        let diag_outs: Vec<DiagnosticItemOut> = diags
            .into_iter()
            .map(|d| DiagnosticItemOut {
                code: d.code.to_string(),
                severity: format!("{:?}", d.severity),
                message: d.message,
                line: d.span.line,
                col: d.span.col,
                start: d.span.start,
                end: d.span.end,
                suggestion: d.suggestion,
            })
            .collect();
        let res = WorkerResponse {
            success: !has_err,
            code: code_opt,
            diagnostics: diag_outs,
            diff: None,
            cached: false,
        };
        println!("{}", serde_json::to_string_pretty(&res).unwrap());
    } else {
        match compile_template(&source) {
            Ok(js) => println!("{}", js),
            Err(diag) => {
                eprintln!("[{}] {}", diag.code, diag.message);
                process::exit(1);
            }
        }
    }
}
