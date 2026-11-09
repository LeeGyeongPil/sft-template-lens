import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildBundle } from "../core/loaders/bundle";
import type { TemplateBundle } from "../core/types";

/** Read tokenizer.json, tokenizer_config.json and (optional) chat_template.jinja from a local folder. */
export function loadFromDirectory(dir: string): TemplateBundle {
  const read = (name: string, required: boolean): string | undefined => {
    const path = join(dir, name);
    if (!existsSync(path)) {
      if (required) throw new Error(`${path} not found. --template-dir needs tokenizer.json and tokenizer_config.json (and chat_template.jinja if the model has one).`);
      return undefined;
    }
    return readFileSync(path, "utf8");
  };
  return buildBundle(
    dir,
    "local",
    {
      tokenizerJson: read("tokenizer.json", true)!,
      tokenizerConfig: read("tokenizer_config.json", true)!,
      chatTemplateFile: read("chat_template.jinja", false),
    },
    false,
    dir,
  );
}
