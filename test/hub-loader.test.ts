import { describe, expect, test } from "vitest";
import { GatedModelError, loadFromHub, type FetchLike } from "../src/core/loaders/hub";
import { loadFromFiles } from "../src/core/loaders/files";
import { readRepo } from "./helpers";

// AC-8: the Hub loader works against a mock fetch; the global fetch is blocked in tests.
const tokenizerJson = readRepo("fixtures/smollm2-135m/tokenizer.json");
const tokenizerConfig = readRepo("fixtures/smollm2-135m/tokenizer_config.json");
const fileTemplate = "{# from chat_template.jinja #}{% for m in messages %}{{ m.content }}{% endfor %}";

function mockFetch(files: Record<string, string>, siblings: string[], status = 200): FetchLike {
  return async (url) => {
    if (status !== 200) return new Response("nope", { status });
    if (url.includes("/api/models/")) return new Response(JSON.stringify({ siblings: siblings.map((rfilename) => ({ rfilename })) }), { status: 200 });
    const name = url.split("/resolve/main/")[1]!;
    return name in files ? new Response(files[name]!, { status: 200 }) : new Response("missing", { status: 404 });
  };
}

describe("Hub loader", () => {
  test("a separate chat_template.jinja wins over tokenizer_config.chat_template", async () => {
    const f = mockFetch({ "tokenizer.json": tokenizerJson, "tokenizer_config.json": tokenizerConfig, "chat_template.jinja": fileTemplate }, ["tokenizer.json", "tokenizer_config.json", "chat_template.jinja"]);
    const bundle = await loadFromHub("owner/model", f);
    expect(bundle.template).toBe(fileTemplate);
    expect(bundle.source).toBe("hub");
    expect(bundle.mock).toBe(false);
  });

  test("without a separate file the tokenizer_config template is used", async () => {
    const f = mockFetch({ "tokenizer.json": tokenizerJson, "tokenizer_config.json": tokenizerConfig }, ["tokenizer.json", "tokenizer_config.json"]);
    const bundle = await loadFromHub("owner/model", f);
    expect(bundle.template).toContain("im_start");
  });

  test("HTTP 401 becomes a gated-model message that says what to do", async () => {
    const f = mockFetch({}, [], 401);
    await expect(loadFromHub("google/gemma-2-2b-it", f)).rejects.toThrow(GatedModelError);
    await expect(loadFromHub("google/gemma-2-2b-it", f)).rejects.toThrow(/gated.*local files|local files.*mirror/i);
  });

  test("404 and bad ids are explained", async () => {
    await expect(loadFromHub("owner/missing", mockFetch({}, [], 404))).rejects.toThrow(/not found/);
    await expect(loadFromHub("not-an-id")).rejects.toThrow(/owner\/name/);
  });

  test("the global fetch is blocked, so a test that forgets to inject one fails loudly", async () => {
    expect(() => fetch("https://huggingface.co/api/models/x/y")).toThrow(/Network access is blocked/);
    await expect(loadFromHub("owner/model")).rejects.toThrow(/Network access is blocked/);
  });

  test("local files: missing tokenizer.json is explained, chat_template.jinja is optional", async () => {
    const file = (name: string, text: string) => ({ name, text: async () => text });
    await expect(loadFromFiles([file("tokenizer_config.json", tokenizerConfig)])).rejects.toThrow(/Missing tokenizer.json/);
    const bundle = await loadFromFiles([file("model/tokenizer.json", tokenizerJson), file("tokenizer_config.json", tokenizerConfig), file("chat_template.jinja", fileTemplate)]);
    expect(bundle.template).toBe(fileTemplate);
    expect(bundle.source).toBe("local");
  });

  test("a model without any chat template is rejected with a fix", async () => {
    const noTemplate = JSON.stringify({ ...JSON.parse(tokenizerConfig), chat_template: undefined });
    const f = mockFetch({ "tokenizer.json": tokenizerJson, "tokenizer_config.json": noTemplate }, ["tokenizer.json", "tokenizer_config.json"]);
    await expect(loadFromHub("owner/model", f)).rejects.toThrow(/No chat template found/);
  });
});
