import type { TemplateBundle, TemplateSource } from "../types";

export interface RawFiles {
  tokenizerJson: string;
  tokenizerConfig: string;
  /** Contents of a separate `chat_template.jinja`, when the model ships one. */
  chatTemplateFile?: string | undefined;
}

/** Parse the three model files into a bundle. A separate chat_template.jinja wins over tokenizer_config. */
export function buildBundle(id: string, source: TemplateSource, raw: RawFiles, mock = false, label = id): TemplateBundle {
  let tokenizerJson: Record<string, unknown>;
  let tokenizerConfig: Record<string, unknown>;
  try {
    tokenizerJson = JSON.parse(raw.tokenizerJson) as Record<string, unknown>;
  } catch {
    throw new Error("tokenizer.json is not valid JSON. Pick the tokenizer.json file of the model.");
  }
  try {
    tokenizerConfig = JSON.parse(raw.tokenizerConfig) as Record<string, unknown>;
  } catch {
    throw new Error("tokenizer_config.json is not valid JSON.");
  }
  const template = raw.chatTemplateFile ?? pickTemplate(tokenizerConfig.chat_template);
  if (!template) {
    throw new Error(
      "No chat template found: tokenizer_config.json has no chat_template and no chat_template.jinja was provided. Add chat_template.jinja from the model repository.",
    );
  }
  return { id, label, source, mock, template, tokenizerJson, tokenizerConfig };
}

/** `chat_template` is a string, or a list of `{name, template}` where "default" is preferred. */
function pickTemplate(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const items = value.filter((v): v is { name?: string; template: string } => typeof v?.template === "string");
    return (items.find((v) => v.name === "default") ?? items[0])?.template ?? null;
  }
  return null;
}
