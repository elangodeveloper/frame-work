//! CLI binary for jarvis-compiler.

use jarvis_compiler::compile_template;
use std::env;
use std::fs;
use std::process;

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();

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
            Ok(s) => s,
            Err(e) => {
                eprintln!("Error reading file '{}': {}", path, e);
                process::exit(1);
            }
        }
    } else if let Some(tmpl) = template_str {
        tmpl
    } else {
        "<h1>Hello Jarvis</h1>".to_string()
    };

    match compile_template(&source) {
        Ok(js) => {
            if emit_json {
                let escaped = js
                    .replace('\\', "\\\\")
                    .replace('"', "\\\"")
                    .replace('\n', "\\n")
                    .replace('\r', "\\r")
                    .replace('\t', "\\t");
                println!("{{\"success\":true,\"code\":\"{}\"}}", escaped);
            } else {
                print!("{}", js);
            }
        }
        Err(diag) => {
            if emit_json {
                let escaped = diag.message
                    .replace('\\', "\\\\")
                    .replace('"', "\\\"")
                    .replace('\n', "\\n")
                    .replace('\r', "\\r");
                println!(
                    "{{\"success\":false,\"code\":\"{}\",\"line\":{},\"col\":{},\"error\":\"{}\"}}",
                    diag.code, diag.span.line, diag.span.col, escaped
                );
            } else {
                eprintln!("{}", diag);
            }
            process::exit(1);
        }
    }
}
