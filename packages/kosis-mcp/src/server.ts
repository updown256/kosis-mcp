#!/usr/bin/env node
/**
 * kosis-mcp — KOSIS 공유서비스 OpenAPI MCP 서버 (stdio).
 * Claude Desktop 등 MCP 클라이언트에서 국가통계포털 통계를 검색·조회한다.
 * 도구 정의는 src/services.ts 레지스트리에서 파생된다.
 * 인증키는 KOSIS_API_KEY 환경변수로만 받는다 (코드/설정 파일에 리터럴 금지).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, type ZodTypeAny } from "zod";
import { KosisError, callService } from "kosis-cli/client";
import { SERVICES, type ServiceDef } from "kosis-cli/services";

/** MCP 응답 과대 출력 방지 (Claude Desktop 컨텍스트 보호) */
const MAX_TEXT_CHARS = 100_000;

function toolInputSchema(def: ServiceDef): Record<string, ZodTypeAny> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const p of def.params) {
    let t: ZodTypeAny = p.enum ? z.enum(p.enum as [string, ...string[]]) : z.string();
    t = t.describe(p.desc);
    shape[p.name] = p.required ? t : t.optional();
  }
  return shape;
}

function renderResult(data: unknown): string {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  if (text.length <= MAX_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_TEXT_CHARS)}\n... [응답이 너무 커서 ${text.length - MAX_TEXT_CHARS}자 잘림 — 조회 범위를 좁히세요 (resultCount, newEstPrdCnt, objL* 지정 등)]`;
}

const server = new McpServer({ name: "kosis", version: "0.1.0" });

for (const def of SERVICES) {
  const toolName = `kosis_${def.id.replace(/-/g, "_")}`;
  server.registerTool(
    toolName,
    {
      title: `KOSIS ${def.id}`,
      description: def.desc,
      inputSchema: toolInputSchema(def),
    },
    async (args: Record<string, unknown>) => {
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(args)) {
        if (typeof v === "string" && v !== "") params[k] = v;
      }
      const key = process.env.KOSIS_API_KEY;
      try {
        const data = await callService(def, params, { apiKey: key });
        return { content: [{ type: "text" as const, text: renderResult(data) }] };
      } catch (e) {
        const msg = e instanceof KosisError ? e.message : `내부 오류: ${e instanceof Error ? e.message : String(e)}`;
        return { content: [{ type: "text" as const, text: `KOSIS 오류: ${msg}` }], isError: true };
      }
    },
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("kosis-mcp: KOSIS OpenAPI MCP 서버 시작됨 (stdio)");
