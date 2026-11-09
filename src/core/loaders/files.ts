import { buildBundle } from "./bundle";
import type { TemplateBundle } from "../types";

const NAMES = ["tokenizer.json", "tokenizer_config.json", "chat_template.jinja"] as const;

/** Build a bundle from user-selected files (browser `File` objects or any object with `name` and `text()`). */
export async function loadFromFiles(files: Array<{ name: string; text(): Promise<string> }>, label = "local files"): Promise<TemplateBundle> {
  const byName = new Map<string, { name: string; text(): Promise<string> }>();
  for (const f of files) {
    const base = f.name.split(/[\\/]/).pop() ?? f.name;
    if ((NAMES as readonly string[]).includes(base)) byName.set(base, f);
  }
  const missing = ["tokenizer.json", "tokenizer_config.json"].filter((n) => !byName.has(n));
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(" and ")}. Select tokenizer.json, tokenizer_config.json and (if the model has one) chat_template.jinja.`);
  }
  const jinja = byName.get("chat_template.jinja");
  return buildBundle(
    label,
    "local",
    {
      tokenizerJson: await byName.get("tokenizer.json")!.text(),
      tokenizerConfig: await byName.get("tokenizer_config.json")!.text(),
      chatTemplateFile: jinja ? await jinja.text() : undefined,
    },
    false,
    label,
  );
}
