import tokenizerJson from "../../../fixtures/smollm2-135m/tokenizer.json?raw";
import tokenizerConfig from "../../../fixtures/smollm2-135m/tokenizer_config.json?raw";
import smollm2 from "../../../fixtures/templates/smollm2.jinja?raw";
import smollm3 from "../../../fixtures/templates/smollm3.jinja?raw";
import qwen25 from "../../../fixtures/templates/qwen2_5.jinja?raw";
import qwen3 from "../../../fixtures/templates/qwen3.jinja?raw";
import systemUnsupported from "../../../fixtures/templates/system-unsupported.jinja?raw";
import demoJsonl from "../../../examples/demo.jsonl?raw";
import type { TemplateBundle } from "../types";
import { buildBundle } from "./bundle";

/** Offline practice (mock) templates. Every one is tokenized with the SmolLM2 tokenizer. */
export const BUNDLED_TEMPLATES: Record<string, { label: string; template: string }> = {
  smollm2: { label: "SmolLM2 (ChatML, no markers)", template: smollm2 },
  smollm3: { label: "SmolLM3 (generation markers + date)", template: smollm3 },
  qwen2_5: { label: "Qwen2.5 (ChatML)", template: qwen25 },
  qwen3: { label: "Qwen3 (non-prefix, think block)", template: qwen3 },
  "system-unsupported": { label: "Gemma 2 style (system role rejected)", template: systemUnsupported },
};

export const BUNDLED_IDS = Object.keys(BUNDLED_TEMPLATES);

/** The bundled demo dataset text (examples/demo.jsonl). */
export const DEMO_JSONL: string = demoJsonl;

/** Build one of the offline practice bundles. This is a mock combination, not a real model. */
export function loadBundled(name: string): TemplateBundle {
  const entry = BUNDLED_TEMPLATES[name];
  if (!entry) {
    throw new Error(`Unknown bundled template "${name}". Choose one of: ${BUNDLED_IDS.join(", ")}.`);
  }
  const bundle = buildBundle(
    name,
    "bundled",
    { tokenizerJson, tokenizerConfig, chatTemplateFile: entry.template },
    true,
    `${entry.label} + SmolLM2 tokenizer (practice mock)`,
  );
  return bundle;
}
