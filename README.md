# kosis-mcp

국가통계포털(KOSIS) 공유서비스 OpenAPI를 **CLI**와 **MCP 서버**로 감싼 도구입니다.
터미널에서 한국 통계를 검색·조회하거나, Claude Desktop 같은 MCP 클라이언트에서
"실업률 추이 찾아줘"처럼 자연어로 국가통계를 쓸 수 있게 합니다.

> CLI + MCP server for KOSIS (Korean Statistical Information Service) OpenAPI.
> Search and fetch official Korean statistics from the terminal or any MCP client.

- 커버 범위: KOSIS 공유서비스 7종 전체 — 통합검색 · 통계목록 · 통계자료 · 메타자료 · 통계설명 · 대용량 통계자료 · 통계주요지표
- 의존성: Node.js 18+ (런타임 의존성은 MCP SDK와 zod뿐)
- 인증키: **본인이 직접 무료로 발급** (아래 안내) — 키는 환경변수로만 전달하며 코드·설정에 저장하지 않습니다

## 1. KOSIS 인증키 발급 (필수, 무료)

1. <https://kosis.kr/openapi> 접속 → 회원가입/로그인
2. **활용신청** → 신청현황에서 **인증키** 확인 (회원 당 1개, 모든 서비스 공용)
3. 발급받은 키를 `KOSIS_API_KEY` 환경변수로 설정

```bash
export KOSIS_API_KEY="발급받은-인증키"   # 셸 프로필 또는 시크릿 매니저 사용 권장
```

> 참고: 인증키에는 유효기간이 있습니다. `[err 11]` 오류가 나면 KOSIS 마이페이지에서 기간을 연장하세요.

## 2. 설치

```bash
git clone https://github.com/updown256/kosis-mcp.git
cd kosis-mcp
npm install        # prepare 훅이 자동으로 빌드까지 수행
```

설치 확인:

```bash
node build/cli.js help
```

(npm 전역 설치를 원하면 `npm link` 또는 `npm install -g .` — 이후 `kosis-cli`, `kosis-mcp` 명령 사용 가능)

## 3. CLI 사용법

```
kosis-cli <command> [--파라미터 값 ...] [옵션]
```

| 명령 | 용도 |
|---|---|
| `search` | KOSIS 통합검색 — 검색어로 통계표 찾기 (시작점) |
| `list` | 통계목록 트리 탐색 (주제별/기관별 등) |
| `data` | 통계자료(수치) 조회 |
| `meta` | 메타자료 — 분류/항목 코드, 단위, 주석, 출처 등 |
| `expl` | 통계설명 — 조사목적·주기·용어해설 |
| `bigdata` | 대용량 통계자료 (KOSIS 마이페이지 자료등록 필요) |
| `indicator-expl` | 주요지표 설명자료 |
| `indicator-search` | 주요지표 목록조회 |
| `indicator-data` | 주요지표 수치 상세조회 |
| `indicator-list` | 주요지표 목록 탐색 (listId/수록주기별) |
| `services` | 전체 명령·파라미터 정의를 JSON으로 출력 |
| `help [command]` | 도움말 |

옵션: `--key <인증키>`(기본: `KOSIS_API_KEY` env) · `--pretty`(들여쓰기 출력) · `--debug`(호출 URL을 stderr로, 인증키 제외)

파라미터명은 [KOSIS 개발가이드](https://kosis.kr/openapi)의 영문 항목명과 1:1로 같습니다.

### 전형적인 흐름 — 검색 → 코드 확인 → 수치 조회

```bash
# 1) 통계표 찾기
kosis-cli search 실업률 --resultCount 5 --pretty
#    → 결과에서 ORG_ID(예: 101), TBL_ID(예: DT_1DA7107S) 확보

# 2) 그 표의 분류/항목 코드 확인
kosis-cli meta --type ITM --orgId 101 --tblId DT_1DA7107S --pretty

# 3) 수치 조회 (최신 3개 시점)
kosis-cli data --orgId 101 --tblId DT_1DA7107S \
  --itmId all --objL1 all --prdSe M --newEstPrdCnt 3 --pretty
```

### 그 밖의 예시

```bash
# 주제별 통계 트리 탐색 (parentListId 생략 = 최상위)
kosis-cli list --vwCd MT_ZTITLE
kosis-cli list --vwCd MT_ZTITLE --parentListId A      # '인구' 하위

# 통계설명
kosis-cli expl --orgId 101 --tblId DT_1DA7107S --metaItm All

# 주요지표: 이름으로 찾고 수치 보기
kosis-cli indicator-search --jipyoNm 실업률
kosis-cli indicator-data --jipyoNm 실업률 --srvRn 12
```

`data`의 분류/항목 값 문법: `all`(전체) · `11*`(해당 코드의 하위레벨 포함) · `11+21`(복수 지정)

## 4. MCP 서버 (Claude Desktop 등)

Claude Desktop 설정 파일(`claude_desktop_config.json`)에 추가:

```json
{
  "mcpServers": {
    "kosis": {
      "command": "node",
      "args": ["/절대/경로/kosis-mcp/build/server.js"],
      "env": { "KOSIS_API_KEY": "발급받은-인증키" }
    }
  }
}
```

- 설정 파일 위치: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`
- 재시작하면 `kosis_search`, `kosis_data` 등 10개 도구가 노출됩니다.
- 과대 응답은 100,000자에서 잘리고 범위를 좁히라는 안내가 붙습니다.

## 5. 알아두면 좋은 KOSIS API 특성

이 도구가 자동으로 처리하지만, 원 API를 직접 쓸 때 부딪히는 함정들입니다.

- **비표준 JSON**: KOSIS는 `format=json`이어도 키에 따옴표가 없는 응답(`{err:"30",…}`)을 줍니다. 이 도구는 `jsonVD=Y`를 자동으로 붙여 표준 JSON을 받고, 혹시 남는 비표준 응답도 보정 파싱합니다.
- **최상위 목록**: 개발가이드에는 `parentListId`가 필수로 적혀 있지만, 실제로는 생략해야 최상위 목록이 반환됩니다.
- **호출 제한**: 분당 200건. 통계자료(`data`)는 요청당 4만 셀 이하.
- **오류 코드**: 10 인증키 누락 · 11 인증키 기간만료 · 20 필수변수 누락 · 21 잘못된 변수 · 30 조회결과 없음 · 31 조회결과 초과 · 40 분당 호출 제한 · 41 ROW수 제한 · 42 이용 제한 · 50 서버오류 — CLI/MCP 오류 메시지에 조치 방법이 함께 표시됩니다.
- **`data`의 err 20**: 통계표가 분류를 여러 개 쓰는 경우(objL2, objL3 …) 해당 레벨을 전부 지정해야 합니다. `meta --type ITM`으로 분류 구조를 먼저 확인하세요.

## 6. 개발

```bash
npm run build   # tsc
npm test        # vitest — KOSIS_API_KEY가 있으면 라이브 스모크 포함
```

구조: `src/services.ts`의 서비스 정의 레지스트리 하나에서 CLI 서브커맨드와 MCP 도구가 모두 파생됩니다. 엔드포인트를 추가하려면 레지스트리에 항목 하나만 추가하면 됩니다.

## 라이선스

MIT — 데이터 출처는 국가통계포털(KOSIS)이며, 이용 약관은 [KOSIS 공유서비스 정책](https://kosis.kr/openapi)을 따릅니다.
