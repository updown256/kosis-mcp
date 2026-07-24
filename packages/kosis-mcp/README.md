# kosis-mcp

국가통계포털(KOSIS) 공유서비스 OpenAPI **MCP 서버** — Claude Desktop 등 MCP 클라이언트에서 한국 통계를 자연어로 검색·조회합니다.

Claude Desktop 설정(`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "kosis": {
      "command": "npx",
      "args": ["-y", "kosis-mcp"],
      "env": { "KOSIS_API_KEY": "발급받은-인증키" }
    }
  }
}
```

- 인증키 무료 발급: <https://kosis.kr/openapi> (회원가입 → 활용신청 → 인증키)
- 도구 10개 노출: `kosis_search` `kosis_list` `kosis_data` `kosis_meta` `kosis_expl` `kosis_bigdata` `kosis_indicator_*`
- `spawn npx ENOENT`가 나면 `"command"`에 npx **절대경로**를 쓰세요 (`which npx`).
- 터미널 CLI만 필요하면 이 패키지 대신 [`kosis-cli`](https://www.npmjs.com/package/kosis-cli)(의존성 0)를 설치하세요.

전체 문서·트러블슈팅: <https://github.com/updown256/kosis-mcp>
