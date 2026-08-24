# Test Infrastructure & Feedback Summary

## Test Frameworks & Structure

| Layer | Framework | Location | Script |
|-------|-----------|----------|--------|
| **Client** | Vitest + jsdom | `client/` | `npm test` → `vitest run` |
| **Backend** | pytest | `backend/` | `pytest` discovery |

## Existing Test Files

### Client Tests (Vitest)
1. **`client/src/components/providerMeta.test.ts`** (21 lines) - Tests `getVisibleProviderIds` and persistence to `localStorage`
2. **`client/src/services/localModelDownloadService.test.ts`** (283 lines) - Comprehensive tests for:
   - Artifact URL generation
   - Storage capacity checking with headroom margin
   - WebGPU readiness validation
   - Download readiness (storage + WebGPU both required)
   - Artifact download with caching and progress
   - HF token authorization headers
   - 401/403 gated-model error handling

### Backend Tests (pytest)
1. **`backend/test_imports.py`** - Smoke test verifying module imports (Qdrant, ContextBuilder, ModelRouter, Agent Graph)
2. **`backend/test_enhancements.py`** (113 lines, `unittest.IsolatedAsyncioTestCase`) - Tests for:
   - `compress_tool_output` (short/long/error preservation)
   - `read_full_tool_output` (missing/success cases)
   - `planner_node` (generation, skip-if-planned, skip-if-short-process)
3. **`backend/test_prompt_skill_routing.py`** (208 lines, `unittest.TestCase`) - Skill routing/manifest validation:
   - Legacy mandatory skill selection
   - Platform/capability gating for situational skills
   - Invalid manifest detection
   - CRLF handling
   - Duplicate name detection
   - Empty body parsing
   - Comprehensive validator test (4 error types)

## Feedback & Observations

### Strengths
- **Good coverage of core utilities**: compress_tool_output, skill routing, import verification
- **Solid jsdom integration**: localStorage and navigator API stubbing works well
- **Comprehensive error handling tests**: 401/403, insufficient storage, missing WebGPU
- **Platform/capability gating** tested explicitly in skill routing
- **Manifest validation** catches all expected error types (unsupported fields, kind mismatches, capability requirements, missing triggers)

### Gaps & Recommendations

| Area | Recommendation |
|------|----------------|
| **Integration tests** | Add end-to-end tests for the OAuth connect flow (popup + polling) and MCP server lifecycle (add/connect/disconnect) |
| **WebGPU coverage** | The download service tests WebGPU but could add more edge cases (null adapter, unsupported features) |
| **SettingsModal** | Add tests for the new `activeSettingsTab` state transitions (Providers ↔ Integrations) and sub-tab toggling |
| **MCP transport** | Add tests for the HTTP/SSE transport server and MCP client adapter (`mcp_client.py`) |
| **Flow engine** | Add APScheduler polling trigger tests and step executor templating tests (`{{step.N.output.field}}`) |
| **Backend API routers** | Add FastAPI router tests for `/integrations/*` endpoints (provider catalog, connections CRD, OAuth callback, flow CRUD, webhook) |
| **Coverage** | Current client tests: ~283 lines; backend: ~321 lines. Consider raising coverage thresholds or adding property-based tests. |
| **Test isolation** | The `test_imports.py` script prints status but doesn't use assertions - convert to proper pytest with asserts. |

### Test Execution Notes
- **Client**: `npm run test` runs vitest in `client/`. The existing tests should pass given the recent SettingsModal changes compile cleanly.
- **Backend**: `pytest` from `backend/` discovers all `test_*.py` files. The existing unittest-based tests should run successfully.
- **No root-level test runner** - execution is per-package (client vs backend vs CLI packages).

### Key Integration Points to Test
Given the recent work, prioritize tests for:
1. `SettingsModal.tsx` tab state (`activeSettingsTab` → Providers/Integrations toggle)
2. `GET /api/integrations/mcp/tools` endpoint (aggregates tools from connected MCP servers)
3. OAuth PKCE flow (provider connect → popup → token exchange → polling → connection state)
4. MCP server registry sync (`POST/DELETE/PATCH /mcp/servers`)
5. Skill routing with multi-tenant `space_id`/`conversation_id` scoping

The existing test foundation is solid. The main opportunity is expanding integration coverage across the new MCP/ OAuth / multi-tenant features that were recently implemented.