/**
 * 라이브 스모크 — 실제 KOSIS OpenAPI 호출. KOSIS_API_KEY가 있을 때만 실행.
 * (CI에서는 자동 스킵. 로컬: KOSIS_API_KEY=... npm test)
 */
import { describe, expect, it } from "vitest";
import { callService } from "../src/client.js";
import { getService } from "../src/services.js";

const KEY = process.env.KOSIS_API_KEY;

describe.skipIf(!KEY)("KOSIS 라이브 스모크", () => {
  it("통합검색이 파싱된 결과를 돌려준다", async () => {
    const data = await callService(
      getService("search")!,
      { searchNm: "인구", resultCount: "2" },
      { apiKey: KEY },
    );
    expect(Array.isArray(data)).toBe(true);
    expect(JSON.stringify(data)).toMatch(/TBL_ID/);
  }, 30_000);

  it("통계목록 최상위 탐색 (parentListId 생략)", async () => {
    const data = await callService(getService("list")!, { vwCd: "MT_ZTITLE" }, { apiKey: KEY });
    expect(Array.isArray(data)).toBe(true);
    expect(JSON.stringify(data)).toMatch(/LIST_ID/);
  }, 30_000);

  it("주요지표 목록조회가 지표를 돌려준다", async () => {
    const data = await callService(
      getService("indicator-search")!,
      { jipyoNm: "실업률", numOfRows: "1" },
      { apiKey: KEY },
    );
    expect(JSON.stringify(data)).toMatch(/statJipyoId/);
  }, 30_000);

  it("주요지표 상세조회(rn+srvRn 쌍)가 수치(val)를 돌려준다", async () => {
    const data = await callService(
      getService("indicator-data")!,
      { jipyoNm: "실업률", rn: "1", srvRn: "2", numOfRows: "2" },
      { apiKey: KEY },
    );
    expect(JSON.stringify(data)).toMatch(/"val"/);
  }, 30_000);
});
