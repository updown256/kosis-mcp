#!/usr/bin/env node
/**
 * kosis-cli — KOSIS 공유서비스 OpenAPI 명령줄 클라이언트.
 * 서브커맨드/파라미터는 src/services.ts 레지스트리에서 파생된다.
 */
import { parseArgs } from "node:util";
import { KosisError, buildUrl, callService } from "./client.js";
import { SERVICES, getService, type ServiceDef } from "./services.js";

function usage(): string {
  const cmds = SERVICES.map((s) => `  ${s.id.padEnd(17)} ${s.desc.split(" — ")[0].replace(/^KOSIS /, "")}`).join("\n");
  return `kosis-cli — 국가통계포털(KOSIS) OpenAPI 클라이언트

사용법: kosis-cli <command> [--파라미터 값 ...] [옵션]

명령:
${cmds}
  services          전체 명령·파라미터 정의를 JSON으로 출력
  help [command]    도움말 (명령별 파라미터 상세)

옵션:
  --key <인증키>    KOSIS 인증키 (기본: KOSIS_API_KEY 환경변수)
  --pretty          JSON 들여쓰기 출력 (기본: 한 줄 압축)
  --debug           호출 URL을 stderr로 출력 (인증키 제외)

예시:
  kosis-cli search 실업률 --resultCount 5
  kosis-cli list --vwCd MT_ZTITLE --parentListId MT_ZTITLE
  kosis-cli data --orgId 101 --tblId DT_1DA7001S --itmId all --objL1 all --prdSe M --newEstPrdCnt 3
  kosis-cli meta --type ITM --orgId 101 --tblId DT_1DA7001S

인증키 발급: https://kosis.kr/openapi (회원가입 → 인증키 발급, 무료)`;
}

function commandHelp(def: ServiceDef): string {
  const rows = def.params
    .map((p) => `  --${p.name.padEnd(14)} ${p.required ? "[필수] " : ""}${p.desc}`)
    .join("\n");
  return `kosis-cli ${def.id} — ${def.desc}\n\n파라미터:\n${rows}`;
}

function fail(msg: string, exitCode: number): never {
  console.error(`오류: ${msg}`);
  process.exit(exitCode);
}

async function main(argv: string[]): Promise<void> {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    const target = cmd === "help" ? rest[0] : undefined;
    if (target) {
      const def = getService(target);
      if (!def) fail(`알 수 없는 명령: ${target}`, 2);
      console.log(commandHelp(def));
    } else {
      console.log(usage());
    }
    process.exit(cmd ? 0 : 2);
  }

  if (cmd === "services") {
    console.log(
      JSON.stringify(
        SERVICES.map(({ id, desc, params }) => ({
          id,
          desc,
          params: params.map(({ name, desc: d, required, enum: e }) => ({ name, desc: d, required: !!required, enum: e })),
        })),
      ),
    );
    return;
  }

  const def = getService(cmd);
  if (!def) fail(`알 수 없는 명령: ${cmd} ('kosis-cli help' 참고)`, 2);

  const options: Record<string, { type: "string" | "boolean" }> = {
    key: { type: "string" },
    pretty: { type: "boolean" },
    debug: { type: "boolean" },
    help: { type: "boolean" },
  };
  for (const p of def.params) options[p.name] = { type: "string" };

  let values: Record<string, string | boolean | undefined>;
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({ args: rest, options, strict: true, allowPositionals: true }));
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e), 2);
  }

  if (values.help) {
    console.log(commandHelp(def));
    return;
  }

  const params: Record<string, string> = {};
  for (const p of def.params) {
    const v = values[p.name];
    if (typeof v === "string") params[p.name] = v;
  }
  // 편의: search는 위치 인자 전체를 공백으로 이어 검색어로 받는다
  if (def.id === "search" && positionals.length && !params.searchNm) params.searchNm = positionals.join(" ");
  else if (positionals.length) fail(`위치 인자는 지원하지 않음: ${positionals.join(" ")}`, 2);

  const apiKey = typeof values.key === "string" ? values.key : process.env.KOSIS_API_KEY;
  if (values.debug) console.error(`[debug] ${buildUrl(def, params)}`);

  try {
    const data = await callService(def, params, { apiKey });
    if (typeof data === "string") console.log(data);
    else console.log(JSON.stringify(data, null, values.pretty ? 2 : undefined));
  } catch (e) {
    if (e instanceof KosisError) fail(e.message, 1);
    throw e;
  }
}

main(process.argv.slice(2)).catch((e) => {
  console.error(`오류: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
