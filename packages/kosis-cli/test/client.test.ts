import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KosisError,
  buildUrl,
  callService,
  extractError,
  resolveEndpoint,
  validateParams,
} from "../src/client.js";
import { SERVICES, getService } from "../src/services.js";

function svc(id: string) {
  const def = getService(id);
  if (!def) throw new Error(`no service: ${id}`);
  return def;
}

describe("레지스트리 무결성", () => {
  it("서비스 id는 유일하다", () => {
    const ids = SERVICES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("서비스별 파라미터명은 유일하고 apiKey를 포함하지 않는다 (format은 bigdata만 허용)", () => {
    for (const s of SERVICES) {
      const names = s.params.map((p) => p.name);
      expect(new Set(names).size, s.id).toBe(names.length);
      expect(names, s.id).not.toContain("apiKey");
      if (s.id !== "bigdata") expect(names, s.id).not.toContain("format");
    }
  });
});

describe("buildUrl", () => {
  it("고정 파라미터·format=json 기본값·jsonVD=Y를 붙인다", () => {
    const url = buildUrl(svc("search"), { searchNm: "인구" });
    expect(url.origin + url.pathname).toBe("https://kosis.kr/openapi/statisticsSearch.do");
    expect(url.searchParams.get("method")).toBe("getList");
    expect(url.searchParams.get("searchNm")).toBe("인구");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("jsonVD")).toBe("Y");
  });

  it("apiKey는 buildUrl 결과에 포함되지 않는다 (디버그 출력 안전)", () => {
    const url = buildUrl(svc("search"), { searchNm: "인구" });
    expect(url.searchParams.has("apiKey")).toBe(false);
  });

  it("빈 값 파라미터는 생략한다", () => {
    const url = buildUrl(svc("search"), { searchNm: "인구", sort: "" });
    expect(url.searchParams.has("sort")).toBe(false);
  });

  it("bigdata(미실측 엔드포인트)에는 jsonVD를 붙이지 않는다", () => {
    const url = buildUrl(svc("bigdata"), { userStatsId: "u/1", type: "Generic" });
    expect(url.searchParams.has("jsonVD")).toBe(false);
    expect(buildUrl(svc("search"), { searchNm: "a" }).searchParams.get("jsonVD")).toBe("Y");
  });
});

describe("validateParams", () => {
  it("필수 파라미터 누락을 잡는다", () => {
    expect(() => validateParams(svc("search"), {})).toThrow(/searchNm/);
  });

  it("enum 위반을 잡는다", () => {
    expect(() => validateParams(svc("list"), { vwCd: "WRONG", parentListId: "A" })).toThrow(/vwCd/);
  });

  it("알 수 없는 파라미터를 잡는다", () => {
    expect(() => validateParams(svc("search"), { searchNm: "a", bogus: "1" })).toThrow(/bogus/);
  });

  it("data: 통계표선택 방식 필수 조합", () => {
    expect(() => validateParams(svc("data"), { prdSe: "M", newEstPrdCnt: "1" })).toThrow(/orgId/);
  });

  it("data: userStatsId 방식이면 orgId 불필요", () => {
    expect(() =>
      validateParams(svc("data"), { userStatsId: "u/101/DT_X", prdSe: "M", newEstPrdCnt: "1" }),
    ).not.toThrow();
  });

  it("data: 시점기준/최신자료기준 중 하나 필요", () => {
    expect(() =>
      validateParams(svc("data"), { orgId: "101", tblId: "T", itmId: "all", objL1: "all", prdSe: "M" }),
    ).toThrow(/시점/);
    expect(() =>
      validateParams(svc("data"), {
        orgId: "101",
        tblId: "T",
        itmId: "all",
        objL1: "all",
        prdSe: "M",
        startPrdDe: "202001",
        endPrdDe: "202012",
      }),
    ).not.toThrow();
  });

  it("meta: type=ORG 외에는 tblId 필수", () => {
    expect(() => validateParams(svc("meta"), { type: "TBL", orgId: "101" })).toThrow(/tblId/);
    expect(() => validateParams(svc("meta"), { type: "ORG", orgId: "101" })).not.toThrow();
  });

  it("expl: statId 또는 orgId+tblId", () => {
    expect(() => validateParams(svc("expl"), {})).toThrow(/statId/);
    expect(() => validateParams(svc("expl"), { orgId: "101", tblId: "T" })).not.toThrow();
  });
});

describe("주요지표 엔드포인트 선택", () => {
  it("indicator-expl: jipyoId → pkNumberService, jipyoNm → indExpService", () => {
    expect(resolveEndpoint(svc("indicator-expl"), { jipyoId: "1" }).endpoint).toBe("pkNumberService.do");
    expect(resolveEndpoint(svc("indicator-expl"), { jipyoNm: "실업률" }).endpoint).toBe("indExpService.do");
  });

  it("indicator-data: jipyoId → indIdDetail, jipyoNm → indDetail", () => {
    expect(resolveEndpoint(svc("indicator-data"), { jipyoId: "1" }).fixed.serviceDetail).toBe("indIdDetail");
    expect(resolveEndpoint(svc("indicator-data"), { jipyoNm: "실업률" }).fixed.serviceDetail).toBe("indDetail");
  });

  it("indicator-search: jipyoId → indIdListSearchRequest(indIdList), jipyoNm → indListSearchRequest", () => {
    const byId = resolveEndpoint(svc("indicator-search"), { jipyoId: "274" });
    expect(byId.endpoint).toBe("indIdListSearchRequest.do");
    expect(byId.fixed.serviceDetail).toBe("indIdList");
    expect(resolveEndpoint(svc("indicator-search"), { jipyoNm: "실업률" }).endpoint).toBe(
      "indListSearchRequest.do",
    );
  });

  it("indicator-data: 시점/최신자료 파라미터는 쌍으로만 허용", () => {
    expect(() => validateParams(svc("indicator-data"), { jipyoId: "274", srvRn: "3" })).toThrow(/rn\+srvRn/);
    expect(() => validateParams(svc("indicator-data"), { jipyoId: "274", strtPrdDe: "202301" })).toThrow(
      /strtPrdDe\+endPrdDe/,
    );
    expect(() =>
      validateParams(svc("indicator-data"), { jipyoId: "274", rn: "1", srvRn: "3" }),
    ).not.toThrow();
    expect(() =>
      validateParams(svc("indicator-data"), { jipyoId: "274", strtPrdDe: "202301", endPrdDe: "202312" }),
    ).not.toThrow();
  });

  it("bigdata: type 필수", () => {
    expect(() => validateParams(svc("bigdata"), { userStatsId: "u/1" })).toThrow(/type/);
  });

  it("indicator-list: listId → service=3, prdSe → prList", () => {
    expect(resolveEndpoint(svc("indicator-list"), { listId: "L" }).fixed.service).toBe("3");
    expect(resolveEndpoint(svc("indicator-list"), { prdSe: "M" }).endpoint).toBe("prListSearchRequest.do");
  });
});

describe("parseLenient — KOSIS 비표준 JSON(따옴표 없는 키) 보정", () => {
  it("따옴표 없는 키의 오류 응답을 파싱한다", async () => {
    const { parseLenient } = await import("../src/client.js");
    expect(parseLenient('{err:"30",errMsg:"데이터가 존재하지 않습니다."}')).toEqual({
      err: "30",
      errMsg: "데이터가 존재하지 않습니다.",
    });
  });

  it("따옴표 없는 키의 배열 응답을 파싱한다", async () => {
    const { parseLenient } = await import("../src/client.js");
    expect(parseLenient('[{LIST_NM:"인구",LIST_ID:"A"}]')).toEqual([{ LIST_NM: "인구", LIST_ID: "A" }]);
  });

  it("JSON이 아니면 null", async () => {
    const { parseLenient } = await import("../src/client.js");
    expect(parseLenient("<xml>ok</xml>")).toBeNull();
  });
});

describe("extractError", () => {
  it("정상 배열 응답은 null", () => {
    expect(extractError([{ TBL_ID: "X" }])).toBeNull();
  });

  it("err 코드 응답을 도움말과 함께 매핑한다", () => {
    const e = extractError({ err: "30", errMsg: "조회결과가 없습니다." });
    expect(e?.code).toBe("30");
    expect(e?.msg).toMatch(/조회결과/);
  });

  it("숫자 err 코드도 처리한다", () => {
    expect(extractError({ err: 40 })?.code).toBe("40");
  });
});

describe("callService", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("인증키 없으면 KosisError(10)", async () => {
    await expect(callService(svc("search"), { searchNm: "a" }, {})).rejects.toMatchObject({ code: "10" });
  });

  it("정상 JSON 응답을 파싱해 반환하고 apiKey를 URL에 붙인다", async () => {
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: URL | string) => {
        calledUrl = String(u);
        return new Response(JSON.stringify([{ TBL_NM: "인구총조사" }]), { status: 200 });
      }),
    );
    const data = await callService(svc("search"), { searchNm: "인구" }, { apiKey: "TESTKEY" });
    expect(data).toEqual([{ TBL_NM: "인구총조사" }]);
    expect(calledUrl).toContain("apiKey=TESTKEY");
  });

  it("KOSIS 오류 응답이면 KosisError를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ err: "11", errMsg: "만료" }), { status: 200 })),
    );
    await expect(callService(svc("search"), { searchNm: "a" }, { apiKey: "K" })).rejects.toMatchObject({
      code: "11",
    });
  });

  it("비JSON(sdmx) 응답은 원문을 돌려준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<xml>ok</xml>", { status: 200 })));
    const data = await callService(svc("search"), { searchNm: "a" }, { apiKey: "K" });
    expect(data).toBe("<xml>ok</xml>");
  });

  it("XML 오류 봉투(<err>…</err>)는 KosisError로 매핑한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<error><err>11</err><errMsg>인증키 기간이 만료되었습니다.</errMsg></error>", {
            status: 200,
          }),
      ),
    );
    await expect(callService(svc("search"), { searchNm: "a" }, { apiKey: "K" })).rejects.toMatchObject({
      code: "11",
    });
  });

  it("HTTP 오류는 KosisError로 감싼다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(callService(svc("search"), { searchNm: "a" }, { apiKey: "K" })).rejects.toThrow(/500/);
  });

  it("네트워크 실패도 KosisError로 감싼다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(callService(svc("search"), { searchNm: "a" }, { apiKey: "K" })).rejects.toBeInstanceOf(
      KosisError,
    );
  });
});
