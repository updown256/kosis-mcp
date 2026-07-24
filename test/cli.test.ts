import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const CLI = new URL("../build/cli.js", import.meta.url).pathname;

function run(args: string[], env: Record<string, string | undefined> = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, KOSIS_API_KEY: undefined, ...env },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

describe("kosis-cli (build/cli.js)", () => {
  it("인자 없이 실행하면 도움말 + exit 2 (REPL hang 없음)", () => {
    const r = run([]);
    expect(r.code).toBe(2);
    expect(r.stdout).toMatch(/사용법/);
  });

  it("help <command>는 파라미터 상세를 보여준다", () => {
    const r = run(["help", "data"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/objL1/);
  });

  it("알 수 없는 명령은 exit 2", () => {
    const r = run(["nope"]);
    expect(r.code).toBe(2);
  });

  it("알 수 없는 플래그는 exit 2", () => {
    const r = run(["search", "인구", "--bogus", "1"]);
    expect(r.code).toBe(2);
  });

  it("services는 레지스트리 JSON을 출력한다", () => {
    const r = run(["services"]);
    expect(r.code).toBe(0);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.length).toBeGreaterThanOrEqual(10);
  });

  it("키 없이 호출하면 발급 안내와 함께 실패한다", () => {
    const r = run(["search", "인구"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/kosis\.kr\/openapi/);
  });
});
