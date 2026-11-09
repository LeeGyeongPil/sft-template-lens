# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-10

### Added
- Inspection engine: OpenAI `messages`, ShareGPT and Alpaca normalization, chat template rendering with `@huggingface/jinja`, tokenization with `@huggingface/tokenizers`, exact (`{% generation %}`) and approximate (assistant content) loss masks, right-truncation report, rules E001-E005 and W101-W112.
- Static single-file web app (`dist/index.html`) with summary cards, histogram, issue table and colored token view.
- `sft-template-lens check` CLI with `--json`, `--show`, `--out-clean`, `--out-issues`, `--fail-on`.
- Offline practice (mock) mode with the bundled SmolLM2 tokenizer and four real public chat templates.
