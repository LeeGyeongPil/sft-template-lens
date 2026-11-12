# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-11-12

### Added
- English and Korean for the web app and the CLI. The web app has a language menu (English / 한국어) in the header; the choice is saved in `localStorage` (`sft-template-lens.lang`), only the first visit follows the browser language, and `<html lang>` follows the choice.
- CLI `--lang en|ko`, then the `SFT_TEMPLATE_LENS_LANG` environment variable, then `LC_ALL`, `LC_MESSAGES`, `LANG`; anything that is not Korean falls back to English. Help, summary, token view, rule descriptions (`--rules`) and error messages are translated.
- Error details are translated too. For template parse errors, tokenizer load errors and unknown errors, only the leading sentence follows the selected language; the cause after it is the original English text from the underlying library (listed under Known limits in the README, together with two known quirks: a network failure with no proxy (`fetch failed`) is not fully translated, and the gated-model message uses an `Error:` prefix and is also shown for a mistyped model ID).
- One message table (`src/i18n.ts`) typed so a key missing in either language fails `npm run typecheck`; tests for key parity, language switching and CLI priority.

### Changed
- The web app opens in English by default (it was Korean only), and `index.html` starts with `<html lang="en">`.
- With a Korean locale (`LANG=ko_KR.UTF-8`) the CLI's human-readable output is now Korean. Pin `--lang en` (or `SFT_TEMPLATE_LENS_LANG=en`) in scripts that match on the text. `--json`, `--out-clean`, `--out-issues`, rule ids and finding messages are unchanged and always English.

## [0.1.2] - 2026-11-11

### Changed
- README: add `--show` to the CLI options table.

## [0.1.1] - 2026-11-10

### Changed
- README: replace the comparison table with a short when-to-use section.

## [0.1.0] - 2026-11-10

### Added
- Inspection engine: OpenAI `messages`, ShareGPT and Alpaca normalization, chat template rendering with `@huggingface/jinja`, tokenization with `@huggingface/tokenizers`, exact (`{% generation %}`) and approximate (assistant content) loss masks, right-truncation report, rules E001-E005 and W101-W112.
- Static single-file web app (`dist/index.html`) with summary cards, histogram, issue table and colored token view.
- `sft-template-lens check` CLI with `--json`, `--show`, `--out-clean`, `--out-issues`, `--fail-on`.
- Offline practice (mock) mode with the bundled SmolLM2 tokenizer and four real public chat templates.
