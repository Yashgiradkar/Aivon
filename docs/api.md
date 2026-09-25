# API Reference

> See also: [architecture.md](./architecture.md) · [implementation.md](./implementation.md)

---

## API Architecture

Aivon does not expose a traditional REST API. All client-server communication goes through the **Convex client SDK** using three function types:

| Type | Description | Use case |
|------|-------------|---------|
| `query` | Real-time reactive reads | Listing conversations, messages |
| `mutation` | Transactional writes | Creating sessions, updating status |
| `action` | Async functions that can call external APIs | Sending messages (AI), file upload, Vapi |

All Convex functions are typed end-to-end via generated types in `packages/backend/convex/_generated/`.

---

## Authentication

### Dashboard (private/ functions)
Requires a **Clerk JWT** passed via the Convex client. The client library handles this automatically when wrapped in `<ClerkProvider>` + configured Convex provider. The JWT must contain `orgId` as a claim.

### Widget (public/ functions)
Requires a valid **`contactSessionId`** (a Convex document ID from the `contactSessions` table). Sessions are created unauthenticated and expire after 24 hours.

### HTTP Webhook
The `/clerk-webhook` endpoint requires a **Svix signature** in headers (`svix-id`, `svix-timestamp`, `svix-signature`). Signature verified against `CLERK_WEBHOOK_SECRET`.

---

## Public Functions (Widget-Facing)

No authentication required. All functions are in `convex/public/`.

---

### Contact Sessions

#### `public.contactSessions.create` — mutation

Creates a new visitor session for the widget.

**Args:**
```typescript
{
  name: string;
  email: string;
  organizationId: string;
  metadata?: {
    userAgent?: string;
    language?: string;
    languages?: string;
    platform?: string;
    vendor?: string;
    screenResolution?: string;
    viewportSize?: string;
    timezone?: string;
    timezoneOffset?: number;
    cookieEnabled?: boolean;
    referrer?: string;
    currentUrl?: string;
  }
}
```

**Returns:** `Id<"contactSessions">`

**Errors:** None (no auth required for creation)

---

#### `public.contactSessions.validate` — mutation

Validates an existing session is still active.

**Args:**
```typescript
{ contactSessionId: Id<"contactSessions"> }
```

**Returns:**
```typescript
{ valid: false; reason: string }
| { valid: true; contactSession: Doc<"contactSessions"> }
```

---

### Widget Settings

#### `public.widgetSettings.getByOrganizationId` — query

Fetches widget display settings for an organization. No auth required (used to render widget before session).

**Args:**
```typescript
{ organizationId: string }
```

**Returns:**
```typescript
{
  _id: Id<"widgetSettings">;
  organizationId: string;
  greetMessage: string;
  defaultSuggestions: {
    suggestion1?: string;
    suggestion2?: string;
    suggestion3?: string;
  };
  vapiSettings: {
    assistantId?: string;
    phoneNumber?: string;
  };
} | null
```

---

### Conversations (Widget)

#### `public.conversations.create` — mutation

Creates a new conversation thread with the AI agent's greeting message.

**Args:**
```typescript
{
  organizationId: string;
  contactSessionId: Id<"contactSessions">;
}
```

**Returns:** `Id<"conversations">`

**Errors:**
- `UNAUTHORIZED` — session invalid or expired

**Side effects:** Refreshes the contact session if within 4h threshold; saves greeting message to AI thread.

---

#### `public.conversations.getMany` — query

Lists conversations for a contact session (paginated).

**Args:**
```typescript
{
  contactSessionId: Id<"contactSessions">;
  paginationOpts: PaginationOpts;  // { numItems: number; cursor: string | null }
}
```

**Returns:** Paginated list with `lastMessage` attached to each conversation.

**Errors:**
- `UNAUTHORIZED` — session invalid or expired

---

#### `public.conversations.getOne` — query

Gets a single conversation. Verifies the conversation belongs to the requesting session.

**Args:**
```typescript
{
  conversationId: Id<"conversations">;
  contactSessionId: Id<"contactSessions">;
}
```

**Returns:**
```typescript
{
  _id: Id<"conversations">;
  status: "unresolved" | "escalated" | "resolved";
  threadId: string;
}
```

**Errors:**
- `UNAUTHORIZED` — session invalid, expired, or conversation belongs to different session
- `NOT_FOUND` — conversation not found

---

### Messages (Widget)

#### `public.messages.create` — action

Sends a message from the widget user. Conditionally triggers the AI agent.

**Args:**
```typescript
{
  prompt: string;
  threadId: string;
  contactSessionId: Id<"contactSessions">;
}
```

**Returns:** `void` (messages delivered via real-time Convex subscription)

**Errors:**
- `UNAUTHORIZED` — session invalid or expired
- `NOT_FOUND` — conversation not found
- `BAD_REQUEST` — conversation is resolved (cannot send to resolved conversations)

**AI trigger condition:** `conversation.status === "unresolved" && subscription.status === "active"`

**Side effects:** Refreshes session; optionally runs AI agent with tools.

---

#### `public.messages.getMany` — query

Lists messages in a thread (paginated, real-time reactive).

**Args:**
```typescript
{
  threadId: string;
  paginationOpts: PaginationOpts;
  contactSessionId: Id<"contactSessions">;
}
```

**Returns:** Paginated `MessageDoc[]` from `@convex-dev/agent`

**Errors:**
- `UNAUTHORIZED` — session invalid or expired

---

### Public Secrets

#### `public.secrets.getVapiSecrets` — action

Returns the Vapi public API key for an organization (used by widget to initialize Vapi voice).

**Args:**
```typescript
{ organizationId: string }
```

**Returns:**
```typescript
{ publicApiKey: string } | null
```

Returns `null` if no Vapi plugin configured or credentials incomplete.

---

## Private Functions (Dashboard-Facing)

All functions require a valid Clerk JWT with `orgId` claim. All functions are in `convex/private/`.

---

### Conversations (Dashboard)

#### `private.conversations.getMany` — query

Lists all conversations for the authenticated organization, with optional status filter.

**Args:**
```typescript
{
  paginationOpts: PaginationOpts;
  status?: "unresolved" | "escalated" | "resolved";
}
```

**Returns:** Paginated list of conversations with `lastMessage` and `contactSession` attached.

**Errors:**
- `UNAUTHORIZED` — no identity or no orgId in JWT

---

#### `private.conversations.getOne` — query

Gets a single conversation with contact session details.

**Args:**
```typescript
{ conversationId: Id<"conversations"> }
```

**Returns:** Conversation doc merged with `contactSession` doc.

**Errors:**
- `UNAUTHORIZED` — no identity, no orgId, or org mismatch
- `NOT_FOUND` — conversation or contact session not found

---

#### `private.conversations.updateStatus` — mutation

Manually updates a conversation's status.

**Args:**
```typescript
{
  conversationId: Id<"conversations">;
  status: "unresolved" | "escalated" | "resolved";
}
```

**Returns:** `void`

**Errors:**
- `UNAUTHORIZED` — no identity, no orgId, or org mismatch
- `NOT_FOUND` — conversation not found

---

### Messages (Dashboard)

#### `private.messages.create` — mutation

Sends a message from an operator. Auto-escalates the conversation if currently unresolved.

**Args:**
```typescript
{
  prompt: string;
  conversationId: Id<"conversations">;
}
```

**Returns:** `void`

**Errors:**
- `UNAUTHORIZED` — no identity, no orgId, or org mismatch
- `NOT_FOUND` — conversation not found
- `BAD_REQUEST` — conversation is resolved

**Side effects:** If status is `unresolved`, patches to `escalated`. Saves message with `agentName: identity.familyName`.

---

#### `private.messages.enhanceResponse` — action

Uses AI to enhance an operator's draft message.

**Args:**
```typescript
{ prompt: string }
```

**Returns:** `string` — enhanced message text

**Errors:**
- `UNAUTHORIZED` — no identity or no orgId
- `BAD_REQUEST` — subscription not active

---

#### `private.messages.getMany` — query

Lists messages in a conversation thread (paginated).

**Args:**
```typescript
{
  threadId: string;
  paginationOpts: PaginationOpts;
}
```

**Returns:** Paginated `MessageDoc[]`

**Errors:**
- `UNAUTHORIZED` — no identity, no orgId, or org mismatch
- `NOT_FOUND` — conversation not found

---

### Widget Settings (Dashboard)

#### `private.widgetSettings.upsert` — mutation

Creates or updates widget settings for the authenticated org.

**Args:**
```typescript
{
  greetMessage: string;
  defaultSuggestions: {
    suggestion1?: string;
    suggestion2?: string;
    suggestion3?: string;
  };
  vapiSettings: {
    assistantId?: string;
    phoneNumber?: string;
  };
}
```

**Returns:** `void`

**Errors:**
- `UNAUTHORIZED` — no identity or no orgId

---

#### `private.widgetSettings.getOne` — query

Gets widget settings for the authenticated org.

**Args:** `{}`

**Returns:** Widget settings doc or `null`

---

### Files / Knowledge Base (Dashboard)

#### `private.files.addFile` — action

Uploads a file to Convex storage, extracts text, and indexes it into RAG.

**Args:**
```typescript
{
  filename: string;
  mimeType: string;
  bytes: ArrayBuffer;
  category?: string;
}
```

**Returns:**
```typescript
{ url: string | null; entryId: EntryId }
```

**Errors:**
- `UNAUTHORIZED` — no identity or no orgId
- `BAD_REQUEST` — subscription not active

**Supported MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`, `text/*`

---

#### `private.files.list` — query

Lists all indexed files for the org, with optional category filter.

**Args:**
```typescript
{
  category?: string;
  paginationOpts: PaginationOpts;
}
```

**Returns:**
```typescript
{
  page: Array<{
    id: EntryId;
    name: string;
    type: string;       // file extension
    size: string;       // human-readable (e.g., "2.4 MB")
    status: "ready" | "processing" | "error";
    url: string | null;
    category?: string;
  }>;
  isDone: boolean;
  continueCursor: string;
}
```

**Errors:**
- `UNAUTHORIZED` — no identity or no orgId

---

#### `private.files.deleteFile` — mutation

Deletes a file from storage and removes it from the RAG index.

**Args:**
```typescript
{ entryId: EntryId }
```

**Returns:** `void`

**Errors:**
- `UNAUTHORIZED` — no identity, no orgId, or file belongs to different org
- `NOT_FOUND` — entry not found

---

### Plugins (Dashboard)

#### `private.plugins.getOne` — query

Gets plugin registration for a service.

**Args:**
```typescript
{ service: "vapi" }
```

**Returns:** Plugin doc or `null`

---

#### `private.plugins.remove` — mutation

Removes a plugin registration (disconnects the integration).

**Args:**
```typescript
{ service: "vapi" }
```

**Returns:** `void`

**Errors:**
- `UNAUTHORIZED` — no identity or no orgId
- `NOT_FOUND` — plugin not found

---

### Secrets (Dashboard)

#### `private.secrets.upsert` — mutation

Stores API credentials for a plugin via AWS Secrets Manager (deferred action).

**Args:**
```typescript
{
  service: "vapi";
  value: any;  // { privateApiKey: string; publicApiKey: string }
}
```

**Returns:** `void`

---

### Vapi (Dashboard)

#### `private.vapi.getAssistants` — action

Lists Vapi assistants for the connected Vapi account.

**Args:** `{}`

**Returns:** `Vapi.Assistant[]`

**Errors:**
- `UNAUTHORIZED` — no identity or no orgId
- `NOT_FOUND` — Vapi plugin not connected or credentials incomplete

---

#### `private.vapi.getPhoneNumbers` — action

Lists Vapi phone numbers for the connected Vapi account.

**Args:** `{}`

**Returns:** `Vapi.PhoneNumbersListResponseItem[]`

**Errors:**
- `UNAUTHORIZED` — no identity or no orgId
- `NOT_FOUND` — Vapi plugin not connected or credentials incomplete

---

## HTTP Endpoints

Exposed via `convex/http.ts` on the Convex site URL (`CONVEX_SITE_URL`).

#### `POST /clerk-webhook`

Receives Clerk subscription webhook events.

**Authentication:** Svix signature headers:
```
svix-id: <event-id>
svix-timestamp: <unix-timestamp>
svix-signature: <signature>
```

**Handled events:**
- `subscription.updated` — updates org `maxAllowedMemberships` (5 if active, 1 if inactive) and upserts subscription record in DB.

**Response:** `200 OK` on success, `400 Bad Request` on validation failure or missing org ID.

---

## Pagination

All paginated queries use Convex's cursor-based pagination:

```typescript
// Request
paginationOpts: {
  numItems: number;    // page size
  cursor: string | null;  // null for first page, cursor from previous response
}

// Response
{
  page: T[];
  isDone: boolean;         // true if no more results
  continueCursor: string;  // pass as cursor for next page
}
```

---

## Error Format

All Convex errors use structured `ConvexError`:

```typescript
// Client receives:
error.data === { code: string; message: string }

// Codes:
"UNAUTHORIZED"  // authentication or authorization failure
"NOT_FOUND"     // resource does not exist
"BAD_REQUEST"   // invalid input state (e.g., resolved conversation, inactive subscription)
```

---

## Embed Widget Integration

Website owners embed the widget via a `<script>` tag:

```html
<script 
  src="https://aivon-chat.vercel.app/widget.js" 
  data-organization-id="org_xxxxxxxxxxxxxxxx"
  data-position="bottom-right"
></script>
```

**Attributes:**
| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-organization-id` | Yes | — | Clerk organization ID |
| `data-position` | No | `bottom-right` | `bottom-right` or `bottom-left` |

**JavaScript API** (exposed as `window.EchoWidget`):
```typescript
window.EchoWidget.show()      // Open the widget
window.EchoWidget.hide()      // Close the widget
window.EchoWidget.destroy()   // Remove from DOM
window.EchoWidget.init({ organizationId?, position? })  // Reinitialize
```

**postMessage events** (from widget to host page):
```typescript
{ type: "close" }                          // Widget requests close
{ type: "resize", payload: { height: number } }  // Widget requests resize
```
