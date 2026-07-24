# kosis-cli

국가통계포털(KOSIS) 공유서비스 OpenAPI CLI — 한국 통계를 터미널에서 검색·조회합니다. **런타임 의존성 0**.

```bash
npm install -g kosis-cli

export KOSIS_API_KEY="발급받은-인증키"   # 무료 발급: https://kosis.kr/openapi
kosis-cli search 실업률 --resultCount 5 --pretty
kosis-cli meta --type ITM --orgId 101 --tblId DT_1DA7107S
kosis-cli data --orgId 101 --tblId DT_1DA7107S --itmId all --objL1 all --prdSe M --newEstPrdCnt 3
```

명령 10개: `search` `list` `data` `meta` `expl` `bigdata` `indicator-expl` `indicator-search` `indicator-data` `indicator-list` (+ `services`, `help`)

- KOSIS의 비표준 JSON(따옴표 없는 키), 공식 가이드 오기(`strtPrdDe` 등)를 전부 보정해 둔 클라이언트입니다.
- Claude Desktop 등 MCP 클라이언트에서 쓰려면 CLI 대신 [`kosis-mcp`](https://www.npmjs.com/package/kosis-mcp)를 설치하세요.

전체 문서·파라미터 상세: <https://github.com/updown256/kosis-mcp>
