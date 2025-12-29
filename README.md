# n8n-nodes-kumiho

This is an n8n community node for [Kumiho](https://kumiho.io), the graph-native creative asset management system.

## Features

- **Kumiho Event Stream Trigger**: React to real-time events like `revision.created`, `tag.applied`, or `item.deleted`.
- **Kumiho Item**: Perform operations on items.
- **Kumiho Project**: Create, read, list, or delete Kumiho projects.
- **Kumiho Space**: Create, read, list, or delete Kumiho spaces.
- **Kumiho Revision**: Manage version control revisions.
- **Kumiho Artifact**: Handle file references and artifacts.
- **Kumiho Bundle**: Group items into bundles.
- **Kumiho Graph**: Manage relationships and analyze dependencies between revisions.
- **Kumiho Search**: Search across the graph.

## Installation

1. Go to **Settings > Community Nodes** in your n8n instance.
2. Click **Install a new node**.
3. Enter `n8n-nodes-kumiho`.
4. Click **Install**.

## Node Reference

## Testing the Event Stream Trigger

To test the "Kumiho Event Stream" node:

1. Add the **Kumiho Event Stream** node to your workflow.
2. Set **Routing Key Filter** to `revision.*` (to catch all revision events).
3. (Optional) Set **Poll Interval** to `10` seconds for faster testing.
4. Click **Listen for Event** in n8n.
5. In another window (or via CLI/SDK), create a new revision in Kumiho.
6. The node should catch the `revision.created` event.

## Troubleshooting

If events are not being caught:
- Ensure your **Base URL** in credentials points to the correct FastAPI proxy (e.g., `https://api.kumiho.cloud`).
- Check that the **Service Token** has permissions for the tenant you are working in.
- The node uses a **Cursor** to ensure no events are missed between polls. If you want to see past events, you can set **From Beginning** to `true` (requires Creator tier or higher).

## Version History

- **0.1.3**: Fixed `emit` call format and trigger activation race condition.
- **0.1.2**: Fixed event polling timeout and client initialization. Added cursor persistence.
- **0.1.1**: Fixed UI labels for node properties.
- **0.1.0**: Initial release.
