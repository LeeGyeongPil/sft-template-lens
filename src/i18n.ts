// The one place for every user-facing sentence of the web UI and the CLI (English and Korean).
// `ko` is typed as `Messages`, so a key missing in either language fails `npm run typecheck`.
// Not translated on purpose: rule ids, Issue.message (machine output), --json, template text, dataset examples.
import type { RuleInfo } from "./core/checks";
import { EMPTY_INPUT_MESSAGE as EN_EMPTY_INPUT } from "./core/jsonl";

export type Lang = "en" | "ko";
export const LANGS: readonly Lang[] = ["en", "ko"];
export const LANG_STORAGE_KEY = "sft-template-lens.lang";
export const LANG_ENV = "SFT_TEMPLATE_LENS_LANG";

export const isLang = (v: unknown): v is Lang => v === "en" || v === "ko";

/** Anything that starts with "ko" (ko, ko_KR.UTF-8, ko-KR) is Korean; everything else is English. */
export const langFromLocale = (value: string | null | undefined): Lang => (value && /^ko/i.test(value.trim()) ? "ko" : "en");

/** CLI order: --lang > SFT_TEMPLATE_LENS_LANG > LC_ALL > LC_MESSAGES > LANG. Empty values are skipped. */
export function resolveCliLang(flag: string | undefined, env: Record<string, string | undefined>): Lang {
  if (flag !== undefined) return langFromLocale(flag);
  for (const name of [LANG_ENV, "LC_ALL", "LC_MESSAGES", "LANG"]) {
    const v = env[name];
    if (v) return langFromLocale(v);
  }
  return "en";
}

/** Web order: saved choice > browser language (first run only). */
export function resolveWebLang(stored: string | null, navigatorLanguage: string | undefined): Lang {
  return isLang(stored) ? stored : langFromLocale(navigatorLanguage);
}

const en = {
  // ---- web: App
  langMenuLabel: "Language",
  appIntro: "Before you train, render your JSONL with the model's real chat template and tokenizer to check the trained tokens (loss mask), truncation and format errors.",
  busyChecking: "Checking…",
  busyProgress: (done: number, total: number) => `Checking… ${done}/${total}`,
  busyReading: "Reading file…",
  busyHub: "Downloading from the Hub… (can take tens of seconds depending on the model)",
  mockBanner: (demoData: boolean) =>
    `Practice (mock) mode — runs with the bundled SmolLM2 tokenizer and a sample template${demoData ? " and hand-made demo data" : ""}. The template and tokenizer pairing may differ from the real model. Drop your own file here.`,
  diagTitle: "Template diagnosis",
  diagLine: (label: string, exact: boolean) => `${label} · mask: ${exact ? "exact (generation markers)" : "approximate (content position)"}`,
  diagNone: "No template-level warnings.",
  downloadClean: "Download cleaned JSONL (error samples removed)",
  downloadIssues: "Download issue list",
  // ---- web: IssueTable
  issuesTitle: "Issues",
  ruleFilter: "Rule filter",
  filterAll: (n: number) => `All (${n})`,
  noIssues: "No issues.",
  thRule: "Rule",
  thLine: "Line",
  thDesc: "Description",
  templateWord: "template",
  // ---- web: LengthHistogram
  histTitle: "Token length distribution",
  histEmpty: "Length distribution: no samples to show.",
  histAria: "Token length histogram",
  histAxis: (n: number) => `${n} tokens`,
  // ---- web: SourcePanel
  dropHint: "Drop a training JSONL file here or click to choose one. (Processed only in your browser; nothing is uploaded.)",
  bundledTemplate: "Bundled template (practice)",
  hubModelId: "Hub model ID",
  fetchHub: "Fetch from Hub",
  localFiles: "Local files (tokenizer.json, tokenizer_config.json, chat_template.jinja)",
  fixedDate: "Fixed date",
  // ---- web: SummaryCards
  summaryAria: "Summary",
  cardSamples: "Samples",
  cardErrors: "Errors",
  cardWarnings: "Warnings",
  cardSamplesWithErrors: "Samples with errors",
  cardTrainRatio: "Trained token ratio",
  cardZeroAfterTruncation: "Zero trained after truncation",
  // ---- web: TokenView
  tokenViewTitle: "Token view",
  tokenViewLine: (line: number) => `(line ${line})`,
  badgeMask: (exact: boolean): string => (exact ? "Mask exact" : "Mask approximate"),
  badgeTitle: (exact: boolean): string => (exact ? "Computed from {% generation %} markers" : "Approximated from the assistant content position"),
  pickSample: "Pick a sample (click a line in the issue table, or use the hash sample=number).",
  viewAsText: "View as text",
  viewAsTokens: "View as tokens",
  tokenStats: (tokens: string, train: number, after: number) => `${tokens} · trained ${train} · trained after truncation ${after}`,
  legendTrain: "trained",
  legendMasked: "masked",
  legendCut: "cut",
  legendSpecial: "special token",
  maskFailed: "The mask could not be computed (W111). Every token is shown as masked.",
  moreChips: (n: number) => ` … and ${n} more`,
  // ---- plural pairs ("1 token" / "2 tokens")
  tokensOne: (n: number) => `${n} token`,
  tokensOther: (n: number) => `${n} tokens`,
  // ---- CLI
  cliHelp: (version: string, bundled: string, maxSeqLen: number, date: string) => `sft-template-lens ${version}
Render SFT training JSONL with the real chat template and tokenizer, and find loss-mask, truncation and format problems before you train.

Usage
  sft-template-lens check <file.jsonl> (--demo | --template-dir <dir> | --model <owner/name>) [options]

Template source (pick one)
  --demo                 Offline practice (mock) mode: bundled SmolLM2 tokenizer + a bundled template
  --template <name>      Bundled template for --demo: ${bundled} (default smollm2)
  --template-dir <dir>   Folder with tokenizer.json, tokenizer_config.json and optional chat_template.jinja
  --model <owner/name>   Public Hugging Face model (downloads tokenizer files only; set NODE_USE_ENV_PROXY=1 behind a proxy)

Options
  --max-seq-len <n>      Right-truncation limit in tokens (default ${maxSeqLen})
  --date <YYYY-MM-DD>    Fixed date for templates that print the date (default ${date})
  --fail-on <level>      error (default) | warning | never  -> exit code 1 when findings reach that level
  --json                 Print the summary and findings as JSON (always English)
  --show <line>          Print a colored token view of the sample at that source line (green = trained)
  --out-clean <path>     Write samples without errors as {"messages": [...]} JSONL
  --out-issues <path>    Write every finding as JSONL
  --lang <en|ko>         Language of this tool's own messages (default: SFT_TEMPLATE_LENS_LANG, then LC_ALL, LC_MESSAGES, LANG)
  --rules                List rule ids and exit
  -h, --help / -v, --version

Exit codes: 0 ok, 1 findings at --fail-on level, 2 usage or loading error.
`,
  errNoSource: "Choose where the tokenizer and chat template come from: --demo (offline practice), --template-dir <dir> or --model <owner/name>.",
  errManySources: (chosen: string[]) => `Use only one template source, got ${chosen.join(" and ")}.`,
  errTemplateNeedsDemo: "--template only works together with --demo.",
  errUnknownCommand: (command: string) => `Unknown command "${command}". The only command is: check <file.jsonl>. Try --help.`,
  errMissingFile: "Missing the JSONL file. Usage: sft-template-lens check <file.jsonl> --demo",
  errFailOn: (value: string) => `--fail-on must be error, warning or never, got "${value}".`,
  errMaxSeqLen: (value: string) => `--max-seq-len must be a positive integer, got "${value}".`,
  errLang: (value: string) => `--lang must be en or ko, got "${value}".`,
  errCannotRead: (file: string) => `Cannot read "${file}". Check the path.`,
  errShowLine: (value: string, lines: string) => `--show ${value}: no sample at that line. Lines with data: ${lines}.`,
  // ---- errors that come from src/core, the loaders and the option parser (translated here; core text stays English)
  errEmptyInput: "The file has no JSONL rows. Check the path, or write one JSON object per line.",
  errDate: (value: string) => `Invalid date "${value}". Use YYYY-MM-DD, for example 2026-01-01.`,
  errDateDay: (value: string) => `Invalid date "${value}": that calendar day does not exist.`,
  errUnknownTemplate: (name: string, list: string) => `Unknown bundled template "${name}". Choose one of: ${list}.`,
  errTokenizerJson: "tokenizer.json is not valid JSON. Pick the tokenizer.json file of the model.",
  errTokenizerConfigJson: "tokenizer_config.json is not valid JSON.",
  errNoChatTemplate: "No chat template found: tokenizer_config.json has no chat_template and no chat_template.jinja was provided. Add chat_template.jinja from the model repository.",
  errMissingFiles: (names: string) => `Missing ${names}. Select tokenizer.json, tokenizer_config.json and (if the model has one) chat_template.jinja.`,
  errHubId: (id: string) => `"${id}" is not a Hub model id. Use the form owner/name, for example Qwen/Qwen2.5-0.5B-Instruct.`,
  errGated: (id: string) => `"${id}" is a gated or private model (HTTP 401/403). Download tokenizer.json, tokenizer_config.json and chat_template.jinja yourself and load the local files, or use an ungated mirror of the model.`,
  errHubNotFound: (id: string) => `Model "${id}" or one of its tokenizer files was not found (HTTP 404). Check the spelling.`,
  errHubHttp: (status: string) => `Hub request failed with HTTP ${status}. Try again, or load local files.`,
  errDirMissing: (path: string) => `${path} not found. --template-dir needs tokenizer.json and tokenizer_config.json (and chat_template.jinja if the model has one).`,
  errTemplateParse: (reason: string) => `The chat template could not be parsed: ${reason}`,
  errTokenizerLoad: (reason: string) => `tokenizer.json / tokenizer_config.json could not be loaded: ${reason}`,
  errOther: (detail: string) => detail,
  errUnknownOption: (name: string) => `Unknown option '${name}'. Try --help.`,
  errMissingValue: (name: string) => `Option '${name}' needs a value. Try --help.`,
  errOptionNoValue: (name: string) => `Option '${name}' does not take a value. Try --help.`,
  errorPrefix: "error",
  hintPrefix: "hint",
  hintProxy: "behind a proxy, run with NODE_USE_ENV_PROXY=1; or use --template-dir with local files.",
  sumTemplate: "template",
  sumMode: "mode: practice (mock) - bundled SmolLM2 tokenizer, not the real model of this template",
  sumMask: (strategy: string, max: number, date: string) => `mask: ${strategy}   max_seq_len: ${max}   date: ${date}`,
  sumCounts: (samples: number, errors: number, warnings: number, withErrors: number) =>
    `samples: ${samples}   errors: ${errors}   warnings: ${warnings}   samples with errors: ${withErrors}`,
  sumTrainRatio: (pct: string) => `trained tokens kept after truncation: ${pct}% of kept tokens`,
  sumTableHead: "rule  level    count  meaning",
  sumNoFindings: "(no findings)",
  sumFindingsHead: "findings (errors first, up to 15):",
  sumTemplateTag: "[template]",
  sumLineTag: (line: number) => `[line ${line}]`,
  sumMore: (n: number) => `  ... and ${n} more (use --json or --out-issues)`,
  sumMoreOne: "  ... and 1 more (use --json or --out-issues)",
  bundledDemoName: "(bundled demo)",
  viewNothing: (line: number, rules: string) => `Line ${line}: nothing was rendered (${rules}).`,
  viewHead: (line: number, tokens: string, train: number, after: number) => `Line ${line}: ${tokens}, ${train} trained, ${after} trained after truncation`,
  viewLegendTrain: " trained ",
  viewLegendMasked: "masked",
  viewLegendCut: "cut by max_seq_len",
};

export type Messages = typeof en;

const ko: Messages = {
  langMenuLabel: "언어",
  appIntro: "학습 전에, 모델의 실제 채팅 템플릿과 토크나이저로 JSONL을 렌더해 학습 토큰(마스크)·잘림·형식 오류를 확인합니다.",
  busyChecking: "검사 중…",
  busyProgress: (done, total) => `검사 중… ${done}/${total}`,
  busyReading: "파일 읽는 중…",
  busyHub: "허브에서 받는 중… (모델에 따라 수십 초 걸릴 수 있습니다)",
  mockBanner: (demoData) =>
    `연습용 데모(목) 모드 — 번들된 SmolLM2 토크나이저와 샘플 템플릿${demoData ? ", 직접 만든 데모 데이터" : ""}로 동작합니다. 템플릿과 토크나이저 조합이 실제 모델과 다를 수 있습니다. 내 파일을 끌어다 놓으세요.`,
  diagTitle: "템플릿 진단",
  diagLine: (label, exact) => `${label} · 마스크 방식 ${exact ? "정확(generation 표지)" : "근사(content 위치)"}`,
  diagNone: "템플릿 수준 경고가 없습니다.",
  downloadClean: "정리 JSONL 내려받기(오류 샘플 제외)",
  downloadIssues: "문제 목록 내려받기",
  issuesTitle: "문제 표",
  ruleFilter: "규칙 필터",
  filterAll: (n) => `전체 (${n})`,
  noIssues: "문제가 없습니다.",
  thRule: "규칙",
  thLine: "줄",
  thDesc: "설명",
  templateWord: "템플릿",
  histTitle: "토큰 길이 분포",
  histEmpty: "길이 분포: 표시할 샘플이 없습니다.",
  histAria: "토큰 길이 히스토그램",
  histAxis: (n) => `${n} 토큰`,
  dropHint: "학습 JSONL 파일을 여기로 끌어다 놓거나 눌러서 고르세요. (브라우저 안에서만 처리되며 어디에도 전송되지 않습니다)",
  bundledTemplate: "번들 템플릿(연습용)",
  hubModelId: "허브 모델 ID",
  fetchHub: "허브에서 받기",
  localFiles: "로컬 파일(tokenizer.json, tokenizer_config.json, chat_template.jinja)",
  fixedDate: "고정 날짜",
  summaryAria: "요약",
  cardSamples: "샘플 수",
  cardErrors: "오류",
  cardWarnings: "경고",
  cardSamplesWithErrors: "오류 있는 샘플",
  cardTrainRatio: "학습 토큰 비율",
  cardZeroAfterTruncation: "잘림 후 학습 0개",
  tokenViewTitle: "토큰 보기",
  tokenViewLine: (line) => `(줄 ${line})`,
  badgeMask: (exact) => (exact ? "마스크 정확" : "마스크 근사"),
  badgeTitle: (exact) => (exact ? "{% generation %} 표지에서 계산" : "어시스턴트 content 위치로 근사"),
  pickSample: "샘플을 고르세요(문제 표의 줄을 누르거나 해시 sample=번호).",
  viewAsText: "텍스트로 보기",
  viewAsTokens: "토큰으로 보기",
  tokenStats: (tokens, train, after) => `${tokens} · 학습 ${train}개 · 잘림 후 학습 ${after}개`,
  legendTrain: "학습",
  legendMasked: "마스크",
  legendCut: "잘림",
  legendSpecial: "특수 토큰",
  maskFailed: "마스크를 계산하지 못했습니다(W111). 색칠은 모두 마스크로 표시됩니다.",
  moreChips: (n) => ` … 외 ${n}개`,
  tokensOne: (n) => `토큰 ${n}개`,
  tokensOther: (n) => `토큰 ${n}개`,
  cliHelp: (version, bundled, maxSeqLen, date) => `sft-template-lens ${version}
실제 채팅 템플릿과 토크나이저로 SFT 학습용 JSONL을 렌더해, 학습 전에 손실 마스크·잘림·형식 문제를 찾아 줍니다.

사용법
  sft-template-lens check <file.jsonl> (--demo | --template-dir <dir> | --model <owner/name>) [옵션]

템플릿 출처 (하나만 고르세요)
  --demo                 오프라인 연습(목) 모드: 번들된 SmolLM2 토크나이저 + 번들 템플릿
  --template <name>      --demo 용 번들 템플릿: ${bundled} (기본 smollm2)
  --template-dir <dir>   tokenizer.json, tokenizer_config.json, (선택) chat_template.jinja 가 있는 폴더
  --model <owner/name>   공개 Hugging Face 모델(토크나이저 파일만 내려받음, 프록시 뒤에서는 NODE_USE_ENV_PROXY=1)

옵션
  --max-seq-len <n>      오른쪽 잘림 한도(토큰, 기본 ${maxSeqLen})
  --date <YYYY-MM-DD>    날짜를 출력하는 템플릿용 고정 날짜(기본 ${date})
  --fail-on <level>      error(기본) | warning | never  -> 해당 수준의 문제가 있으면 종료 코드 1
  --json                 요약과 문제 목록을 JSON 으로 출력(항상 영어)
  --show <line>          그 줄 샘플의 색칠된 토큰 보기 출력(초록 = 학습)
  --out-clean <path>     오류 없는 샘플을 {"messages": [...]} JSONL 로 저장
  --out-issues <path>    모든 문제를 JSONL 로 저장
  --lang <en|ko>         이 도구 자체 메시지의 언어(기본: SFT_TEMPLATE_LENS_LANG, LC_ALL, LC_MESSAGES, LANG 순)
  --rules                규칙 ID 목록을 출력하고 종료
  -h, --help / -v, --version

종료 코드: 0 정상, 1 --fail-on 수준의 문제 발견, 2 사용법 또는 불러오기 오류.
`,
  errNoSource: "토크나이저와 채팅 템플릿의 출처를 고르세요: --demo(오프라인 연습), --template-dir <dir> 또는 --model <owner/name>.",
  errManySources: (chosen) => `템플릿 출처는 하나만 쓰세요. 받은 값: ${chosen.join(" + ")}.`,
  errTemplateNeedsDemo: "--template 은 --demo 와 함께만 쓸 수 있습니다.",
  errUnknownCommand: (command) => `알 수 없는 명령 "${command}". 명령은 check <file.jsonl> 하나뿐입니다. --help 를 보세요.`,
  errMissingFile: "JSONL 파일이 없습니다. 사용법: sft-template-lens check <file.jsonl> --demo",
  errFailOn: (value) => `--fail-on 은 error, warning, never 중 하나여야 합니다. 받은 값: "${value}".`,
  errMaxSeqLen: (value) => `--max-seq-len 은 1 이상의 정수여야 합니다. 받은 값: "${value}".`,
  errLang: (value) => `--lang 은 en 또는 ko 여야 합니다. 받은 값: "${value}".`,
  errCannotRead: (file) => `"${file}" 을(를) 읽을 수 없습니다. 경로를 확인하세요.`,
  errShowLine: (value, lines) => `--show ${value}: 그 줄에 샘플이 없습니다. 데이터가 있는 줄: ${lines}.`,
  errEmptyInput: "파일에 JSONL 행이 없습니다. 경로를 확인하거나, 한 줄에 JSON 객체 하나씩 쓰세요.",
  errDate: (value) => `날짜 "${value}" 가 올바르지 않습니다. YYYY-MM-DD 형식으로 쓰세요. 예: 2026-01-01.`,
  errDateDay: (value) => `날짜 "${value}" 가 올바르지 않습니다. 달력에 없는 날입니다.`,
  errUnknownTemplate: (name, list) => `알 수 없는 번들 템플릿 "${name}". 다음 중 하나를 고르세요: ${list}.`,
  errTokenizerJson: "tokenizer.json 이 올바른 JSON 이 아닙니다. 모델의 tokenizer.json 파일을 고르세요.",
  errTokenizerConfigJson: "tokenizer_config.json 이 올바른 JSON 이 아닙니다.",
  errNoChatTemplate: "채팅 템플릿을 찾지 못했습니다. tokenizer_config.json 에 chat_template 이 없고 chat_template.jinja 도 주어지지 않았습니다. 모델 저장소의 chat_template.jinja 를 추가하세요.",
  errMissingFiles: (names) => `${names} 이(가) 없습니다. tokenizer.json, tokenizer_config.json 과 (모델에 있다면) chat_template.jinja 를 고르세요.`,
  errHubId: (id) => `"${id}" 는 허브 모델 ID 가 아닙니다. owner/name 형식으로 쓰세요. 예: Qwen/Qwen2.5-0.5B-Instruct.`,
  errGated: (id) => `"${id}" 는 접근이 제한되었거나 비공개인 모델입니다(HTTP 401/403). tokenizer.json, tokenizer_config.json, chat_template.jinja 를 직접 받아 로컬 파일로 불러오거나, 제한 없는 미러 모델을 쓰세요.`,
  errHubNotFound: (id) => `모델 "${id}" 또는 토크나이저 파일을 찾지 못했습니다(HTTP 404). 철자를 확인하세요.`,
  errHubHttp: (status) => `허브 요청이 HTTP ${status} 로 실패했습니다. 다시 시도하거나 로컬 파일을 불러오세요.`,
  errDirMissing: (path) => `${path} 를 찾을 수 없습니다. --template-dir 에는 tokenizer.json 과 tokenizer_config.json (모델에 있다면 chat_template.jinja 도)이 필요합니다.`,
  errTemplateParse: (reason) => `채팅 템플릿을 해석하지 못했습니다. 원인(영어 원문): ${reason}`,
  errTokenizerLoad: (reason) => `tokenizer.json / tokenizer_config.json 을 불러오지 못했습니다. 원인(영어 원문): ${reason}`,
  errOther: (detail) => `처리하지 못했습니다. 원인(영어 원문): ${detail}`,
  errUnknownOption: (name) => `알 수 없는 옵션 '${name}'. --help 를 보세요.`,
  errMissingValue: (name) => `옵션 '${name}' 에 값이 필요합니다. --help 를 보세요.`,
  errOptionNoValue: (name) => `옵션 '${name}' 은 값을 받지 않습니다. --help 를 보세요.`,
  errorPrefix: "오류",
  hintPrefix: "힌트",
  hintProxy: "프록시 뒤라면 NODE_USE_ENV_PROXY=1 로 실행하거나, 로컬 파일과 --template-dir 를 쓰세요.",
  sumTemplate: "템플릿",
  sumMode: "모드: 연습용(목) - 번들된 SmolLM2 토크나이저이며 이 템플릿의 실제 모델이 아닙니다",
  sumMask: (strategy, max, date) => `마스크: ${strategy}   max_seq_len: ${max}   날짜: ${date}`,
  sumCounts: (samples, errors, warnings, withErrors) => `샘플: ${samples}   오류: ${errors}   경고: ${warnings}   오류 있는 샘플: ${withErrors}`,
  sumTrainRatio: (pct) => `잘림 후 남은 토큰 중 학습 토큰: ${pct}%`,
  sumTableHead: "규칙  수준     개수  의미",
  sumNoFindings: "(문제 없음)",
  sumFindingsHead: "발견 항목(오류 먼저, 최대 15개):",
  sumTemplateTag: "[템플릿]",
  sumLineTag: (line) => `[${line}줄]`,
  sumMore: (n) => `  ... 외 ${n}개 (--json 또는 --out-issues 사용)`,
  sumMoreOne: "  ... 외 1개 (--json 또는 --out-issues 사용)",
  bundledDemoName: "(번들 데모)",
  viewNothing: (line, rules) => `${line}줄: 렌더된 내용이 없습니다 (${rules}).`,
  viewHead: (line, tokens, train, after) => `${line}줄: ${tokens}, 학습 ${train}개, 잘림 후 학습 ${after}개`,
  viewLegendTrain: " 학습 ",
  viewLegendMasked: "마스크",
  viewLegendCut: "max_seq_len 으로 잘림",
};

export const MESSAGES: Record<Lang, Messages> = { en, ko };

export const messages = (lang: Lang): Messages => MESSAGES[lang];

/** Plural-aware token count: English splits "1 token" / "N tokens"; Korean uses the same form. */
export const tokenCount = (m: Messages, n: number): string => (n === 1 ? m.tokensOne(n) : m.tokensOther(n));

/** Short rule description in the chosen language (RULES already holds en and ko). */
export const ruleLabel = (rule: RuleInfo, lang: Lang): string => rule[lang];

/**
 * Turn any error thrown by the core, the loaders or the option parser into a sentence in the chosen language.
 * The core keeps its English text (it is also machine output); this maps each known message back to its
 * message-table key, and unknown errors get a translated lead sentence plus the English detail.
 */
export function localizeError(error: unknown, m: Messages): string {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  const text = error instanceof Error ? error.message : String(error);
  const quoted = /'(-[^']*?)(?: <[^']*>)?'/.exec(text)?.[1] ?? "";
  if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") return m.errUnknownOption(quoted);
  if (code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") return /does not take an argument/.test(text) ? m.errOptionNoValue(quoted) : m.errMissingValue(quoted);
  if (text === EN_EMPTY_INPUT) return m.errEmptyInput;
  let r: RegExpExecArray | null;
  if ((r = /^Invalid date "(.*)": that calendar day does not exist\.$/s.exec(text))) return m.errDateDay(r[1]!);
  if ((r = /^Invalid date "(.*)"\. Use YYYY-MM-DD/s.exec(text))) return m.errDate(r[1]!);
  if ((r = /^Unknown bundled template "(.*)"\. Choose one of: (.*)\.$/s.exec(text))) return m.errUnknownTemplate(r[1]!, r[2]!);
  if (/^tokenizer\.json is not valid JSON\./.test(text)) return m.errTokenizerJson;
  if (/^tokenizer_config\.json is not valid JSON\./.test(text)) return m.errTokenizerConfigJson;
  if (/^No chat template found: /.test(text)) return m.errNoChatTemplate;
  if ((r = /^Missing (.+)\. Select tokenizer\.json, /s.exec(text))) return m.errMissingFiles(r[1]!);
  if ((r = /^"(.*)" is not a Hub model id\. /s.exec(text))) return m.errHubId(r[1]!);
  if ((r = /^"(.*)" is a gated or private model /s.exec(text))) return m.errGated(r[1]!);
  if ((r = /^Model "(.*)" or one of its tokenizer files was not found /s.exec(text))) return m.errHubNotFound(r[1]!);
  if ((r = /^Hub request failed with HTTP (\d+)\. /.exec(text))) return m.errHubHttp(r[1]!);
  if ((r = /^(.+?) not found\. --template-dir needs /s.exec(text))) return m.errDirMissing(r[1]!);
  if ((r = /^The chat template could not be parsed: (.*)$/s.exec(text))) return m.errTemplateParse(r[1]!);
  if ((r = /^tokenizer\.json \/ tokenizer_config\.json could not be loaded: (.*)$/s.exec(text))) return m.errTokenizerLoad(r[1]!);
  return m.errOther(text);
}
