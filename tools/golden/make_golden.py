"""Regenerate test/golden/parity.json with the reference Python stack (developer tool, not used by CI).

Run from the repository root:

    uv run --no-project --python 3.12 --with transformers==5.22.2 --with jinja2==3.1.6 \
        python -I tools/golden/make_golden.py

It reads only files inside this repository (fixtures/ and examples/demo.jsonl) and applies the same
`strftime_now(...)` -> fixed-date substitution that the TypeScript engine uses, so dates and locale do not matter.
"""

import datetime
import json
import re
from pathlib import Path

import tokenizers
from tokenizers import Tokenizer
from transformers import AutoTokenizer

ROOT = Path(__file__).resolve().parents[2]
FIXED = datetime.date(2026, 1, 1)
TEMPLATES = ["smollm2", "smollm3", "qwen2_5", "qwen3"]
FILE_NAMES = {"smollm2": "smollm2.jinja", "smollm3": "smollm3.jinja", "qwen2_5": "qwen2_5.jinja", "qwen3": "qwen3.jinja"}


def lens_strftime(fmt: str) -> str:
    # Default C locale in Python: English month and day names.
    return FIXED.strftime(fmt)


def demo_conversations() -> dict:
    """OpenAI-style rows of examples/demo.jsonl that parse and have role/content strings, keyed by line number."""
    out = {}
    for number, raw in enumerate((ROOT / "examples" / "demo.jsonl").read_text(encoding="utf-8").split("\n"), start=1):
        if not raw.strip():
            continue
        try:
            row = json.loads(raw)
        except json.JSONDecodeError:
            continue
        msgs = row.get("messages") if isinstance(row, dict) else None
        if isinstance(msgs, list):
            out[number] = msgs
    return out


def main() -> None:
    tok = AutoTokenizer.from_pretrained(str(ROOT / "fixtures" / "smollm2-135m"))
    # input_ids come from tokenizer.json itself (Rust `tokenizers`). transformers 5.22.2 builds its GPT2Tokenizer with a plain
    # ByteLevel pre-tokenizer and ignores the Digits split in tokenizer.json, which changes how "\n\n6" is tokenized.
    raw = Tokenizer.from_file(str(ROOT / "fixtures" / "smollm2-135m" / "tokenizer.json"))
    convs = demo_conversations()
    golden = {"generator": {"transformers": "5.22.2", "jinja2": "3.1.6", "tokenizers": tokenizers.__version__, "date": FIXED.isoformat()}, "templates": {}}
    for name in TEMPLATES:
        source = (ROOT / "fixtures" / "templates" / FILE_NAMES[name]).read_text(encoding="utf-8")
        # Replace each strftime_now("<format>") call by the formatted fixed date (same result as the TS engine).
        source = re.sub(r"\bstrftime_now\s*\(\s*(['\"])(.*?)\1\s*\)", lambda m: json.dumps(lens_strftime(m.group(2))), source)
        per_line = {}
        for line, msgs in convs.items():
            kwargs = dict(chat_template=source, date_string="01 Jan 2026")
            text = tok.apply_chat_template(msgs, tokenize=False, **kwargs)
            ids = raw.encode(text, add_special_tokens=False).ids
            entry = {"text": text, "input_ids": ids}
            if "{% generation %}" in source or re.search(r"{%-?\s*generation", source):
                enc = tok.apply_chat_template(
                    msgs, tokenize=True, return_dict=True, return_assistant_tokens_mask=True, **kwargs
                )
                assert enc["input_ids"] == ids, f"{name} line {line}: transformers ids differ from tokenizer.json ids, mask cannot be compared"
                entry["assistant_mask"] = list(enc["assistant_masks"])
            per_line[str(line)] = entry
        golden["templates"][name] = per_line
    out = ROOT / "test" / "golden" / "parity.json"
    out.write_text(json.dumps(golden, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
