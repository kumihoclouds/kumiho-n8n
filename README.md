# n8n-nodes-kumiho

This is an n8n community node for [Kumiho](https://kumiho.io), the graph-native creative asset management system.

## Features

This package intentionally ships **three nodes**:

- **Kumiho Event Trigger**: Streaming (SSE) event trigger (created/updated/deleted/tagged) with cursor persistence.
- **Kumiho Action**: One node covering Projects, Spaces, Items, Revisions, Artifacts, Bundles, Graph, and Kref resolve.
- **Kumiho MCP Client**: Invoke MCP tools.

For full operation-by-operation documentation, see the usage guide below.

## Documentation

- Detailed usage: [docs/usage.md](docs/usage.md)
- FastAPI endpoint map: [docs/fastapi-endpoint-map.md](docs/fastapi-endpoint-map.md)
- Consolidation plan: [docs/node-consolidation-plan.md](docs/node-consolidation-plan.md)

## Installation

1. Go to **Settings > Community Nodes** in your n8n instance.
2. Click **Install a new node**.
3. Enter `n8n-nodes-kumiho`.
4. Click **Install**.

## Node Reference

- **Kumiho Event Trigger**: Trigger workflows from Kumiho events via SSE `GET /api/v1/events/stream`.
- **Kumiho Action**: Create/read/update/delete Kumiho resources via FastAPI routes under `/api/v1/*`.
- **Kumiho MCP Client**: Invoke tools via `/api/v1/mcp/invoke`.

For parameters and examples, see [docs/usage.md](docs/usage.md).

## Testing the Event Trigger

To test the **Kumiho Event Trigger** node:

1. Add the **Kumiho Event Trigger** node to your workflow.
2. Set:
	- **Trigger Type**: `Revision`
	- **Stream Action**: `Created`
3. (Optional) Set **Path Filter (Project/Space)** to limit events (e.g. `my-project/my-space`).
4. Set **Reconnect Delay (Seconds)** to `10`.
5. Click **Listen for Event** in n8n.
6. In another window (or via CLI/SDK), create a new revision in Kumiho.
7. The node should emit an event with routing key `revision.created`.

## Troubleshooting

If events are not being caught:
- Ensure your **Base URL** in credentials points to the correct Kumiho API endpoint (e.g., `https://api.kumiho.cloud`).
- Check that the **Service Token** has permissions for the tenant you are working in.
- The node uses a **Cursor** to resume after reconnects. The cursor is stored in workflow static data, and can be overridden via **Advanced → Cursor**.

### Error handling (production)

- All API calls send `x-correlation-id`.
	- When a request fails, the node includes the correlation id (when available) in the error message to simplify support/debugging.
- When the upstream API returns a standard error envelope, the node maps it into the thrown error:
	- `error.code` (string)
	- `error.message` (string)
	- `error.retryable` (boolean)
	- `error.retry_after_ms` (number, optional)
	- `correlation_id` (string)

Security note: the node redacts the `X-Kumiho-Token` header from thrown errors so secrets don't leak into n8n logs or UI error details.

### Timeouts and retry budget

The request helper enforces a per-request timeout and an overall retry budget.

- `KUMIHO_N8N_REQUEST_TIMEOUT_MS` (default: 60000)
- `KUMIHO_N8N_RETRY_BUDGET_MS` (default: 60000)

If the retry budget is exceeded, the node throws an error with code `client_retry_budget_exceeded`.

### Idempotency

For write operations, the nodes may send `x-idempotency-key`. Some create endpoints intentionally disable idempotency headers for compatibility; where idempotency is not used, retries rely on server-side uniqueness and/or client-side GET fallback.

## Version History

- **0.2.0**: Switched Event Trigger to SSE streaming and updated MCP Client to invoke tools.
- **0.1.3**: Fixed `emit` call format and trigger activation race condition.
- **0.1.2**: Fixed event polling timeout and client initialization. Added cursor persistence.
- **0.1.1**: Fixed UI labels for node properties.
- **0.1.0**: Initial release.
