import { buildBundle } from "./bundle";
import type { TemplateBundle } from "../types";

export type FetchLike = (url: string) => Promise<Response>;

export class GatedModelError extends Error {
  constructor(modelId: string) {
    super(
      `"${modelId}" is a gated or private model (HTTP 401/403). Download tokenizer.json, tokenizer_config.json and chat_template.jinja yourself and load the local files, or use an ungated mirror of the model.`,
    );
    this.name = "GatedModelError";
  }
}

const HUB = "https://huggingface.co";

/**
 * Download the tokenizer files of a public Hub model. Only model files are requested; no dataset leaves the machine.
 * `fetchFn` can be injected for tests. A `chat_template.jinja` in the file list wins over tokenizer_config.
 */
export async function loadFromHub(modelId: string, fetchFn: FetchLike = (u) => fetch(u)): Promise<TemplateBundle> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(modelId)) {
    throw new Error(`"${modelId}" is not a Hub model id. Use the form owner/name, for example Qwen/Qwen2.5-0.5B-Instruct.`);
  }
  const info = await fetchFn(`${HUB}/api/models/${modelId}`);
  guard(info, modelId);
  const meta = (await info.json()) as { siblings?: Array<{ rfilename: string }> };
  const files = new Set((meta.siblings ?? []).map((s) => s.rfilename));

  const get = async (name: string): Promise<string> => {
    const res = await fetchFn(`${HUB}/${modelId}/resolve/main/${name}`);
    guard(res, modelId);
    return res.text();
  };
  const [tokenizerJson, tokenizerConfig] = await Promise.all([get("tokenizer.json"), get("tokenizer_config.json")]);
  const chatTemplateFile = files.has("chat_template.jinja") ? await get("chat_template.jinja") : undefined;
  return buildBundle(modelId, "hub", { tokenizerJson, tokenizerConfig, chatTemplateFile }, false, modelId);
}

function guard(res: Response, modelId: string): void {
  if (res.status === 401 || res.status === 403) throw new GatedModelError(modelId);
  if (res.status === 404) throw new Error(`Model "${modelId}" or one of its tokenizer files was not found (HTTP 404). Check the spelling.`);
  if (!res.ok) throw new Error(`Hub request failed with HTTP ${res.status}. Try again, or load local files.`);
}
