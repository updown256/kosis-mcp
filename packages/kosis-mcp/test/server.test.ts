/**
 * MCP stdio 서버 스모크 — initialize → tools/list 왕복으로 도구 노출을 검증.
 * 네트워크 불필요 (KOSIS 호출 전 단계만).
 */
import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const SERVER = new URL("../build/server.js", import.meta.url).pathname;

function handshake(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [SERVER], { stdio: ["pipe", "pipe", "ignore"] });
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("MCP 핸드셰이크 타임아웃"));
    }, 15_000);
    let buf = "";
    proc.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      for (const line of buf.split("\n")) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === 2) {
            clearTimeout(timer);
            proc.kill();
            resolve(msg.result.tools.map((t: { name: string }) => t.name));
            return;
          }
        } catch {
          /* 부분 라인 — 다음 청크 대기 */
        }
      }
    });
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.stdin.write(
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}\n' +
        '{"jsonrpc":"2.0","method":"notifications/initialized"}\n' +
        '{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n',
    );
  });
}

describe("kosis-mcp 서버", () => {
  it("stdio 핸드셰이크 후 도구 10개를 노출한다", async () => {
    const tools = await handshake();
    expect(tools).toHaveLength(10);
    expect(tools).toContain("kosis_search");
    expect(tools).toContain("kosis_indicator_data");
  }, 20_000);
});
