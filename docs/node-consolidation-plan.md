# Node consolidation plan (Trigger + Action + Tool)

Last updated: 2025-12-31

## Goal

Consolidate the current multi-node **kumiho-n8n** surface into:

- **Kumiho Event Trigger** node (poll-based trigger)
- **Kumiho Action** node (single node with `Resource` + `Operation`)
- **Kumiho MCP Client** node (MCP tool execution via Kumiho API)

This is a dev-only breaking change: **no backwards compatibility required**.

## Source of truth

Endpoint inventory and current behavior mapping: [fastapi-endpoint-map.md](fastapi-endpoint-map.md)

## Non-goals

- Adding new FastAPI endpoints
- Redesigning auth/tenant routing
- Adding additional triggers beyond the existing poll mechanism
- Preserving legacy node types or fallback endpoints

## Target node UX

### 1) Kumiho Event Trigger

**Operations**
- `Poll` → `GET /api/v1/events/poll`

**Key behavior**
- Store cursor in workflow static data.
- Support filters: `routing_key_filter`, `kref_filter`, `max_events`, optional `cursor`.
- Emit one n8n item per event.

### 2) Kumiho Action

**Top-level selectors**
- `Resource`: Project | Space | Item | Revision | Artifact | Bundle | Graph | Kref
- `Operation`: Create | Read | Update | Delete

**Notes**
- Operations are intentionally fixed to CRUD (the `kumiho` schema is stable), but each CRUD operation can have a small set of modes (e.g., Revision Read: by kref vs by tag).
- The Action node is for REST-style Kumiho resources; MCP tool execution is handled by **Kumiho MCP Client**.

**n8n convention**
- By default, list/search operations should emit **one n8n item per result** (best for chaining).
- If a workflow needs “single item containing an array” for predictability, expose an explicit **Output Format** option.

**Hiding unsupported operations**
- For each `Resource`, hide unsupported CRUD operations via `displayOptions` so users never see dead-end `Operation` choices.

**Conventions**
- Use CRUD operations; express non-CRUD behaviors via small per-operation modes.
- Keep *Tag* operations under `Resource = Revision` (since endpoints live under `/api/v1/revisions/tags*`).
- Treat `Item Search` as a `Read` mode under `Resource = Item`.
- Keep `Artifact Get by Location` under `Resource = Artifact`.
- Keep all graph traversal and edge creation under `Resource = Graph`.

**Output consistency**
- Single-object reads always emit exactly one n8n item.
- List/search operations default to **one n8n item per result**.
- Expose `Output Format`:
  - `Split into Items` (default)
  - `Single Item (Array)`
- For “Revision Read by Tag”, treat it as a single-object read (1 item output) unless you explicitly model it as a list.

## Resource/operation matrix (v1)

This is the proposed initial scope for the consolidated Action node.

### Project
- Create
- Read
  - Read Mode: Get | List
- Delete

### Space
- Create
- Read
  - Read Mode: Get (by path) | List
- Delete

### Item
- Create
- Read
  - Read Mode: Get (by kref) | Search
- Update
  - Update Mode: Update Metadata | Set Attribute | Deprecate
- Delete

### Revision
- Create
- Read
  - Read Mode: Get (by kref) | Get (by tag) | List Artifacts
- Update
  - Update Mode: Update Metadata | Deprecate
- Delete

**Tag operations (under Revision)**
- Update Mode: Set Tag | Remove Tag
- Read Mode: List Tags | Has a Tag | Was Tagged

### Artifact
- Create
- Read
  - Read Mode: Get (by revision kref + name) | Get by Location
- Update
  - Update Mode: Update Metadata | Deprecate
- Delete

### Bundle (included in UX)
- Create
- Read
  - Read Mode: Get | List Members | History
- Update
  - Update Mode: Add Member | Remove Member

### Graph
- Create
  - Create Mode: Create Edge
- Read
  - Read Mode: List Edges | Get Dependencies | Find Path | Analyze Impact

### Kref
- Read
  - Read Mode: Resolve

## Parameter model (recommended)

Keep inputs consistent across resources:

- Prefer a single `kref` input where possible.
- Where the API distinguishes item vs revision kref:
  - name fields should be explicit (e.g., `revision_kref`, `item_kref`, `bundle_kref`).
- Treat `max_depth` and `edge_types[]` as advanced options with sensible defaults.
- For list/search operations:
  - standardize pagination/limits if present; if absent, keep UX minimal.

## Output model (recommended)

- Default behavior should match n8n expectations:
  - Single-object reads emit exactly one n8n item.
  - List/search emits one n8n item per result.
  - Predicate operations emit one n8n item: `{ result: boolean, ...context }`.

- Provide `Output Format` (Advanced):
  - `Split into Items` (default)
  - `Single Item (Array)` (emits exactly one n8n item whose `json` is an array)

## Error handling rules

- Do not keep legacy fallback routes.
- Do not treat Create operations as idempotent unless the API contract guarantees it.
  - If you still want “Create or Get” semantics, expose it explicitly as an operation and document behavior.
- Surface HTTP status codes and error bodies in node errors.

## Implementation steps

### Phase 0 — inventory and decisions
- Confirm final `Resource` list and exact operation names (matrix above).
- Confirm default output matches n8n expectations (split into items for list/search).
- Confirm whether `Output Format` should be global (node-level) or per-operation.

### Phase 1 — add consolidated node types
- Add new node type for **Kumiho Event Trigger** (poll-based).
- Add new node type for **Kumiho Action** using `Resource` + `Operation`.
- Add new node type for **Kumiho MCP Client** (Kumiho API endpoint pre-configured).
- Reuse the existing request helper (`kumihoRequest()`), credentials, and auth behavior.

### MCP node scope

**Kumiho MCP Client** should:

- Provide a familiar MCP-client UX (select tool + JSON args → result)
- Use Kumiho API credentials and call the FastAPI MCP endpoints (see `kumiho-FastAPI/app/core/mcp.py`)
- Default to Kumiho’s MCP tool surface (no manual endpoint URL required)

### Phase 2 — migrate existing operations
- Port each existing operation implementation to the consolidated Action node.
- Remove any backwards-compat fallbacks (not needed for dev-only).
- Ensure Bundles are fully represented in the consolidated node.

### Phase 3 — tidy and consistency
- Normalize naming, parameter grouping, and defaults across resources.
- Consolidate shared option collections (e.g., pagination, metadata, deprecated).
- Ensure Tag operations are all under `Revision`.

### Phase 4 — validation
- `npm run -s build` in `kumiho-n8n`.
- Run whatever local node smoke test workflow you use:
  - one workflow that exercises each Resource at least once
  - one workflow that tests Trigger cursor progression

### Phase 5 — cleanup
- Remove old node definitions (since compatibility isn’t required).
- Update docs to reference the new nodes and the `Resource/Operation` pattern.

## Acceptance criteria

- Only three nodes are published/available: **Kumiho Event Trigger**, **Kumiho Action**, and **Kumiho MCP Client**.
- Kumiho Action covers all routes listed in [fastapi-endpoint-map.md](fastapi-endpoint-map.md) that are currently used by n8n nodes, including Bundles.
- No legacy fallback endpoints remain.
- Build passes.
