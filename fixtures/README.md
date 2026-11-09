# Bundled fixtures (offline practice mode)

Downloaded on 2026-11-10 from the Hugging Face Hub (`huggingface.co/<repo>`, "resolve" download links at the revision below). All four repositories are marked `apache-2.0`.

| File here | Source repository | Revision | Original file |
|---|---|---|---|
| `smollm2-135m/tokenizer.json` | HuggingFaceTB/SmolLM2-135M-Instruct | `12fd25f77366fa6b3b4b768ec3050bf629380bac` | `tokenizer.json` |
| `smollm2-135m/tokenizer_config.json` | HuggingFaceTB/SmolLM2-135M-Instruct | `12fd25f77366fa6b3b4b768ec3050bf629380bac` | `tokenizer_config.json` |
| `templates/smollm2.jinja` | HuggingFaceTB/SmolLM2-135M-Instruct | `12fd25f77366fa6b3b4b768ec3050bf629380bac` | `chat_template` field of `tokenizer_config.json` |
| `templates/smollm3.jinja` | HuggingFaceTB/SmolLM3-3B | `a07cc9a04f16550a088caea529712d1d335b0ac1` | `chat_template.jinja` |
| `templates/qwen2_5.jinja` | Qwen/Qwen2.5-0.5B-Instruct | `7ae557604adf67be50417f59c2c2f167def9a775` | `chat_template` field of `tokenizer_config.json` |
| `templates/qwen3.jinja` | Qwen/Qwen3-0.6B | `c1899de289a04d12100db370d81485cdf75e47ca` | `chat_template` field of `tokenizer_config.json` |
| `templates/system-unsupported.jinja` | written for this project | - | mimics the Gemma 2 behavior `raise_exception('System role not supported')` |

Every template is tokenized with the SmolLM2 tokenizer. Token counts for the Qwen and SmolLM3 templates therefore differ from the real models; this is the "practice (mock)" part. Llama and Gemma templates are not bundled because of their licenses; use `--model` or `--template-dir` for them.

## Modifications to the bundled tokenizer

`smollm2-135m/tokenizer.json` is not byte-identical to the upstream file. Seven vocabulary entries (common English words that happen to be single tokens) and the seven merge rules that produce them were removed so the repository passes its own public-content checks. Every other token keeps its original id (ids are not renumbered). Text that used those words is now split into smaller pieces, which is still valid tokenization; none of the bundled sample conversations or golden outputs use the removed ids (verified by the parity test).
