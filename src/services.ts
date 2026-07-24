/**
 * KOSIS 공유서비스 OpenAPI 서비스 정의 레지스트리.
 * CLI 서브커맨드와 MCP 도구가 모두 이 테이블에서 파생된다.
 * 파라미터명은 KOSIS 개발가이드의 영문 항목명을 그대로 쓴다(가이드와 1:1 대응).
 */

export interface ParamDef {
  /** KOSIS API 쿼리 파라미터명 (가이드 표기 그대로) */
  name: string;
  desc: string;
  required?: boolean;
  enum?: readonly string[];
}

export interface Resolved {
  endpoint: string;
  fixed: Record<string, string>;
}

export interface ServiceDef {
  /** CLI 서브커맨드명이자 MCP 도구명(kosis_ 접두 + _ 치환)의 근거 */
  id: string;
  desc: string;
  endpoint: string;
  /** 항상 붙는 고정 쿼리 파라미터 */
  fixed?: Record<string, string>;
  params: ParamDef[];
  /** 파라미터 조합 검증 — 문제 있으면 한국어 메시지, 통과면 null */
  validate?: (p: Record<string, string>) => string | null;
  /** 파라미터에 따라 엔드포인트가 달라지는 서비스(주요지표)의 선택 로직 */
  resolve?: (p: Record<string, string>) => Resolved;
}

export const VW_CODES = [
  "MT_ZTITLE",
  "MT_OTITLE",
  "MT_CHOSUN_TITLE",
  "MT_HANKUK_TITLE",
  "MT_STOP_TITLE",
  "MT_ATITLE01",
  "MT_ATITLE02",
  "MT_GTITLE01",
  "MT_ETITLE",
] as const;

export const META_TYPES = [
  "TBL",
  "ORG",
  "PRD",
  "ITM",
  "CMMT",
  "UNIT",
  "SOURCE",
  "WGT",
  "NCD",
] as const;

const PRD_SE_DESC =
  "수록주기 (Y=년, H=반기, Q=분기, M=월, D=일, IR=부정기)";

const PERIOD_PARAMS: ParamDef[] = [
  { name: "startPrdDe", desc: "시작수록시점 (예: 202001)" },
  { name: "endPrdDe", desc: "종료수록시점 (예: 202412)" },
  { name: "newEstPrdCnt", desc: "최근수록시점 개수 (시점기준 대신 최신자료기준 조회)" },
  { name: "prdInterval", desc: "수록시점 간격" },
];

const PAGE_PARAMS: ParamDef[] = [
  { name: "pageNo", desc: "페이지 번호 (기본 1)" },
  { name: "numOfRows", desc: "페이지당 결과 수 (기본 10)" },
];

/** 시점기준(startPrdDe+endPrdDe) 또는 최신자료기준(newEstPrdCnt) 중 하나가 필요 */
function needPeriod(p: Record<string, string>): string | null {
  if (p.newEstPrdCnt) return null;
  if (p.startPrdDe && p.endPrdDe) return null;
  return "조회시점 필요: startPrdDe+endPrdDe(시점기준) 또는 newEstPrdCnt(최신자료기준) 중 하나";
}

export const SERVICES: ServiceDef[] = [
  {
    id: "search",
    desc: "KOSIS 통합검색 — 검색어로 통계표를 찾는다. 통계표의 orgId/tblId를 모를 때 시작점.",
    endpoint: "statisticsSearch.do",
    fixed: { method: "getList" },
    params: [
      { name: "searchNm", desc: "검색어", required: true },
      { name: "sort", desc: "정렬 (RANK=정확도, DATE=최신순)", enum: ["RANK", "DATE"] },
      { name: "startCount", desc: "페이지 번호 (resultCount 단위)" },
      { name: "resultCount", desc: "결과 수 (기본 20)" },
    ],
  },
  {
    id: "list",
    desc: "통계목록 — 서비스뷰(주제별/기관별 등) 트리를 단계적으로 탐색한다. 결과에 TBL_ID가 있으면 통계표, LIST_ID만 있으면 하위목록.",
    endpoint: "statisticsList.do",
    fixed: { method: "getList" },
    params: [
      {
        name: "vwCd",
        desc: "서비스뷰 코드 (MT_ZTITLE=주제별, MT_OTITLE=기관별, MT_CHOSUN_TITLE=광복이전, MT_HANKUK_TITLE=통계연감, MT_STOP_TITLE=작성중지, MT_ATITLE01/02=지역통계, MT_GTITLE01=e-지방지표, MT_ETITLE=영문)",
        required: true,
        enum: VW_CODES,
      },
      // 가이드에는 필수로 표기돼 있으나 실제로는 생략 시 최상위 목록이 반환된다 (2026-07 실측)
      { name: "parentListId", desc: "시작목록 ID (생략 시 최상위 목록, 결과의 LIST_ID로 하위 탐색)" },
    ],
  },
  {
    id: "data",
    desc: "통계자료 — 통계표의 수치자료 조회. orgId+tblId+itmId+objL1 조합(통계표선택) 또는 userStatsId(자료등록) 방식. 분류/항목 값: all(전체), 11*(하위레벨 포함), 11+21(복수). 요청은 4만 셀 이하.",
    endpoint: "statisticsData.do",
    fixed: { method: "getList" },
    params: [
      { name: "orgId", desc: "기관 ID (search/list 결과의 ORG_ID)" },
      { name: "tblId", desc: "통계표 ID (search/list 결과의 TBL_ID)" },
      { name: "itmId", desc: "항목 ID (all=전체, meta --type ITM으로 확인)" },
      { name: "objL1", desc: "분류1 코드 (all=전체)" },
      { name: "objL2", desc: "분류2 코드" },
      { name: "objL3", desc: "분류3 코드" },
      { name: "objL4", desc: "분류4 코드" },
      { name: "objL5", desc: "분류5 코드" },
      { name: "objL6", desc: "분류6 코드" },
      { name: "objL7", desc: "분류7 코드" },
      { name: "objL8", desc: "분류8 코드" },
      { name: "userStatsId", desc: "사용자 등록 통계표 ID (자료등록 방식일 때)" },
      { name: "prdSe", desc: PRD_SE_DESC, required: true },
      ...PERIOD_PARAMS,
      { name: "outputFields", desc: "응답필드 선택 (예: ORG_ID+TBL_ID+ITM_NM)" },
      { name: "smblChk", desc: "통계부호 표시 (Y)" },
    ],
    validate: (p) => {
      if (!p.userStatsId) {
        const need = ["orgId", "tblId", "itmId", "objL1"].filter((k) => !p[k]);
        if (need.length)
          return `통계표선택 방식은 ${need.join(", ")} 필수 (자료등록 방식이면 userStatsId 사용)`;
      }
      return needPeriod(p);
    },
  },
  {
    id: "meta",
    desc: "메타자료 — 통계표의 메타정보 조회. type: TBL=통계표명, ORG=기관명, PRD=수록정보, ITM=분류/항목(코드 확인용), CMMT=주석, UNIT=단위, SOURCE=출처, WGT=가중치, NCD=자료갱신일.",
    endpoint: "statisticsData.do",
    fixed: { method: "getMeta" },
    params: [
      { name: "type", desc: "메타 유형", required: true, enum: META_TYPES },
      { name: "orgId", desc: "기관 ID", required: true },
      { name: "tblId", desc: "통계표 ID (type=ORG 외 필수)" },
      { name: "objId", desc: "분류코드 (type=ITM에서 선택)" },
      { name: "itmId", desc: "자료코드 (type=ITM에서 선택)" },
      { name: "detail", desc: "전체시점 정보 제공 (type=PRD에서 Y)" },
    ],
    validate: (p) => {
      if (p.type !== "ORG" && !p.tblId) return "type=ORG 외에는 tblId 필수";
      return null;
    },
  },
  {
    id: "expl",
    desc: "통계설명 — 통계조사에 대한 설명자료(조사목적·주기·연혁·용어해설 등). statId 또는 orgId+tblId로 지정.",
    endpoint: "statisticsExplData.do",
    params: [
      { name: "statId", desc: "통계조사 ID (search 결과의 STAT_ID)" },
      { name: "orgId", desc: "기관 ID (statId 대신 tblId와 조합)" },
      { name: "tblId", desc: "통계표 ID (statId 대신 orgId와 조합)" },
      {
        name: "metaItm",
        desc: "요청 항목 (All=전체, statsNm=조사명, writingPurps=조사목적, statsPeriod=조사주기, examinHistory=조사연혁, mainTermExpl=주요 용어해설 등)",
      },
    ],
    validate: (p) => {
      if (!p.statId && !(p.orgId && p.tblId)) return "statId 또는 orgId+tblId 필요";
      return null;
    },
  },
  {
    id: "bigdata",
    desc: "대용량 통계자료 — KOSIS 마이페이지에서 자료등록 후 발급되는 userStatsId로 통계표 전체를 내려받는다.",
    endpoint: "statisticsBigData.do",
    params: [
      { name: "userStatsId", desc: "사용자 등록 통계표 ID", required: true },
      { name: "type", desc: "SDMX 유형", enum: ["DSD", "Generic", "StructureSpecific"] },
      { name: "prdSe", desc: PRD_SE_DESC },
      ...PERIOD_PARAMS,
      { name: "version", desc: "결과값 구분 (생략 시 구버전 출력)" },
      { name: "smblChk", desc: "통계부호 표시 (Y)" },
    ],
  },
  {
    id: "indicator-expl",
    desc: "통계주요지표 설명자료 — jipyoId(고유번호) 또는 jipyoNm(지표명)으로 지표의 개념 설명을 조회.",
    endpoint: "pkNumberService.do",
    params: [
      { name: "jipyoId", desc: "지표 ID" },
      { name: "jipyoNm", desc: "지표명" },
      ...PAGE_PARAMS,
    ],
    validate: (p) => (p.jipyoId || p.jipyoNm ? null : "jipyoId 또는 jipyoNm 필요"),
    resolve: (p) =>
      p.jipyoId
        ? { endpoint: "pkNumberService.do", fixed: { method: "getList", service: "1", serviceDetail: "pkAll" } }
        : { endpoint: "indExpService.do", fixed: { method: "getList", service: "2", serviceDetail: "indAll" } },
  },
  {
    id: "indicator-search",
    desc: "통계주요지표 목록조회 — jipyoNm(지표명) 또는 jipyoId(고유번호)로 지표 목록(단위·수록기간 포함)을 찾는다.",
    endpoint: "indListSearchRequest.do",
    fixed: { method: "getList", service: "4", serviceDetail: "indList" },
    params: [
      { name: "jipyoNm", desc: "지표명" },
      { name: "jipyoId", desc: "지표 ID" },
      ...PAGE_PARAMS,
    ],
    validate: (p) => (p.jipyoId || p.jipyoNm ? null : "jipyoNm 또는 jipyoId 필요"),
  },
  {
    id: "indicator-data",
    desc: "통계주요지표 상세조회 — 지표의 실제 수치(val)를 시점별로 조회. jipyoId 또는 jipyoNm으로 지정.",
    endpoint: "indIdDetailSearchRequest.do",
    params: [
      { name: "jipyoId", desc: "지표 ID" },
      { name: "jipyoNm", desc: "지표명" },
      { name: "startPrdDe", desc: "조회 시작 시점" },
      { name: "endPrdDe", desc: "조회 종료 시점" },
      { name: "rn", desc: "조회 기준 시점 (최신자료기준)" },
      { name: "srvRn", desc: "조회 시점 개수 (최신자료기준)" },
      ...PAGE_PARAMS,
    ],
    validate: (p) => (p.jipyoId || p.jipyoNm ? null : "jipyoId 또는 jipyoNm 필요"),
    resolve: (p) =>
      p.jipyoId
        ? { endpoint: "indIdDetailSearchRequest.do", fixed: { method: "getList", service: "4", serviceDetail: "indIdDetail" } }
        : { endpoint: "indDetailSearchRequest.do", fixed: { method: "getList", service: "4", serviceDetail: "indDetail" } },
  },
  {
    id: "indicator-list",
    desc: "통계주요지표 목록 탐색 — listId(세부목록) 또는 prdSe(수록주기)별로 지표 목록을 조회.",
    endpoint: "indiListService.do",
    params: [
      { name: "listId", desc: "목록 ID" },
      { name: "prdSe", desc: PRD_SE_DESC },
      ...PAGE_PARAMS,
    ],
    validate: (p) => (p.listId || p.prdSe ? null : "listId 또는 prdSe 필요"),
    resolve: (p): Resolved =>
      p.listId
        ? { endpoint: "indiListService.do", fixed: { method: "getList", service: "3" } }
        : { endpoint: "prListSearchRequest.do", fixed: { method: "getList", service: "4", serviceDetail: "prList" } },
  },
];

export function getService(id: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.id === id);
}
