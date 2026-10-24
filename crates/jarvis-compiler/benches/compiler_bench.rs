use criterion::{black_box, criterion_group, criterion_main, Criterion};
use jarvis_compiler::{compile_template, compile_templates_parallel, CodeGenerator, ExpressionParser, IrLowerer, Lexer, Parser, Span};

fn bench_compiler_pipeline(c: &mut Criterion) {
    let simple_template = "<div class=\"user-card\"><h1>Hello {{ name }}</h1><p>{{ email }}</p></div>";
    let complex_template = r#"
        <div class="dashboard-container" [class.dark]="isDark">
            <header class="topbar">
                <h1>{{ title }}</h1>
                <user-card [user]="currentUser" (select)="onSelect($event)" />
            </header>
            <main>
                @if (isLoading) {
                    <div class="spinner">Loading...</div>
                } @else {
                    <ul class="item-list">
                        @for (item of items; track item.id) {
                            <li [id]="item.id" (click)="selectItem(item.id)">
                                <span>{{ item.name }}</span>
                                <input [(value)]="item.note" />
                            </li>
                        }
                    </ul>
                }
            </main>
        </div>
    "#;

    c.bench_function("compile_simple_template", |b| {
        b.iter(|| {
            let res = compile_template(black_box(simple_template)).unwrap();
            black_box(res);
        });
    });

    c.bench_function("compile_complex_template", |b| {
        b.iter(|| {
            let res = compile_template(black_box(complex_template)).unwrap();
            black_box(res);
        });
    });

    c.bench_function("lexer_stages", |b| {
        b.iter(|| {
            let mut lexer = Lexer::new(black_box(complex_template));
            let tokens = lexer.tokenize();
            black_box(tokens);
        });
    });

    c.bench_function("parser_stages", |b| {
        b.iter(|| {
            let mut lexer = Lexer::new(black_box(complex_template));
            let tokens = lexer.tokenize();
            let mut parser = Parser::new(tokens);
            let ast = parser.parse_all();
            black_box(ast);
        });
    });

    c.bench_function("expression_parser_stages", |b| {
        let expr_str = "user.isActive && (count + 1 > maxThreshold ? getDiscount(user.tier) : 0)";
        b.iter(|| {
            let ast = ExpressionParser::parse_expression(black_box(expr_str), Span::dummy()).unwrap();
            black_box(ast);
        });
    });

    c.bench_function("ir_and_codegen_stages", |b| {
        let mut lexer = Lexer::new(complex_template);
        let tokens = lexer.tokenize();
        let mut parser = Parser::new(tokens);
        let ast = parser.parse_all();

        b.iter(|| {
            let mut lowerer = IrLowerer::new();
            let ir = lowerer.lower(black_box(&ast));
            let js = CodeGenerator::generate_js(black_box(&ir)).unwrap();
            black_box(js);
        });
    });

    let templates: Vec<&str> = (0..50).map(|_| complex_template).collect();
    c.bench_function("end_to_end_parallel_batch", |b| {
        b.iter(|| {
            let res = compile_templates_parallel(black_box(&templates));
            black_box(res);
        });
    });
}

criterion_group!(benches, bench_compiler_pipeline);
criterion_main!(benches);
