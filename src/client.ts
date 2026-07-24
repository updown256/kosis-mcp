/**
 * KOSIS OpenAPI HTTP 클라이언트 — URL 조립, 호출, 오류 매핑.
 * 인증키는 호출 시점에만 URL에 붙이며 로그/오류 메시지에는 절대 노출하지 않는다.
 */
import type { Resolved, ServiceDef } from "./services.js";

export const BASE_URL = "https://kosis.kr/openapi/";

/** KOSIS 개발가이드 1.4 오류메시지 유형 */
export const ERR_HELP: Record<string, string> = {
  "10": "인증키 누락 — KOSIS_API_KEY 설정 확인",
  "11": "인증키 기간만료 — kosis.kr 마이페이지에서 기간 연장",
  "20": "필수요청변수 누락",
  "21": "잘못된 요청변수",
  "30": "조회결과 없음 — 조회조건 확인",
  "31": "조회결과 초과 — 요청 범위 축소 (통계자료는 4만 셀 제한)",
  "40": "호출가능건수 제한 초과 (분당 200건)",
  "41": "호출가능 ROW수 제한 초과",
  "42": "사용자별 이용 제한",
  "50": "KOSIS 서버오류",
};

export class KosisError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "KosisError";
  }
}

export function resolveEndpoint(def: ServiceDef, params: Record<string, string>): Resolved {
  if (def.resolve) return def.resolve(params);
  return { endpoint: def.endpoint, fixed: def.fixed ?? {} };
}

/** 필수/enum/조합 검증. 문제가 있으면 KosisError를 던진다. */
export function validateParams(def: ServiceDef, params: Record<string, string>): void {
  const known = new Set(def.params.map((p) => p.name));
  for (const k of Object.keys(params)) {
    if (!known.has(k)) throw new KosisError(`알 수 없는 파라미터: ${k}`);
  }
  for (const p of def.params) {
    const v = params[p.name];
    if (p.required && !v) throw new KosisError(`필수 파라미터 누락: ${p.name} (${p.desc})`);
    if (v && p.enum && !p.enum.includes(v))
      throw new KosisError(`${p.name} 값은 ${p.enum.join("|")} 중 하나여야 함 (입력: ${v})`);
  }
  const msg = def.validate?.(params);
  if (msg) throw new KosisError(msg);
}

/** apiKey를 제외한 호출 URL 생성 (디버그 출력용으로도 안전) */
export function buildUrl(def: ServiceDef, params: Record<string, string>): URL {
  const { endpoint, fixed } = resolveEndpoint(def, params);
  const url = new URL(endpoint, BASE_URL);
  for (const [k, v] of Object.entries(fixed)) url.searchParams.set(k, v);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  if (!url.searchParams.has("format")) url.searchParams.set("format", "json");
  // KOSIS는 format=json이어도 기본으로 따옴표 없는 키의 비표준 JSON을 반환한다.
  // jsonVD=Y를 붙이면 전 엔드포인트에서 표준 JSON이 온다 (2026-07 실측).
  if (url.searchParams.get("format") === "json") url.searchParams.set("jsonVD", "Y");
  return url;
}

/**
 * jsonVD를 무시하는 엔드포인트 대비 — 따옴표 없는 키({err:"30"} 등)를 보정해 파싱 시도.
 * 실패하면 null (호출부가 원문 반환 판단).
 */
export function parseLenient(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    /* fallthrough */
  }
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  const quoted = t.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
  try {
    return JSON.parse(quoted);
  } catch {
    return null;
  }
}

/** KOSIS 오류 응답({err, errMsg}) 감지 — 배열/정상 객체면 null */
export function extractError(data: unknown): { code?: string; msg: string } | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  if (o.err === undefined && o.errMsg === undefined) return null;
  const code = o.err === undefined ? undefined : String(o.err);
  const help = code ? ERR_HELP[code] : undefined;
  const msg = [code && `[err ${code}]`, o.errMsg && String(o.errMsg), help && `(${help})`]
    .filter(Boolean)
    .join(" ");
  return { code, msg: msg || "KOSIS 오류 응답" };
}

export interface CallOptions {
  /** 미지정 시 KosisError — 호출부는 환경변수/옵션에서 받아 넘긴다 */
  apiKey?: string;
  timeoutMs?: number;
}

/**
 * 서비스 호출. JSON이면 파싱해 오류를 검사하고, JSON이 아니면(sdmx 등) 원문을 반환한다.
 */
export async function callService(
  def: ServiceDef,
  params: Record<string, string>,
  opts: CallOptions,
): Promise<unknown> {
  validateParams(def, params);
  if (!opts.apiKey) {
    throw new KosisError(
      "KOSIS 인증키가 없습니다. KOSIS_API_KEY 환경변수 또는 --key 옵션을 설정하세요. 발급: https://kosis.kr/openapi",
      "10",
    );
  }
  const url = buildUrl(def, params);
  url.searchParams.set("apiKey", opts.apiKey);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      headers: { "User-Agent": "kosis-mcp (github.com/updown256/kosis-mcp)" },
    });
  } catch (e) {
    const cause = e instanceof Error ? e.message : String(e);
    throw new KosisError(`KOSIS 호출 실패 (네트워크): ${cause}`);
  }
  const text = await res.text();
  if (!res.ok) throw new KosisError(`KOSIS HTTP 오류: ${res.status} ${res.statusText}`);

  const data = parseLenient(text);
  if (data === null) return text; // format=sdmx 등 비JSON 응답은 원문 그대로
  const err = extractError(data);
  if (err) throw new KosisError(err.msg, err.code);
  return data;
}
