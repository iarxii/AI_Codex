## Plan: Attachment Phase 2 (Multipart + File References)

Define the production-grade attachment architecture that evolves the current inline attachment-context transport into robust multipart upload and file-reference messaging for both LiteChat and Workspace chat flows.

**Goals**
1. Preserve current Phase 1 behavior as fallback.
2. Introduce server-managed attachment storage and retrieval.
3. Support larger files and richer multimodal handling without bloating prompt payloads.
4. Keep provider/model routing compatibility with existing chat endpoints.

**Scope**
1. Frontend upload workflow for LiteChat and Workspace.
2. Backend upload APIs, validation, and temporary storage lifecycle.
3. Chat payload contract updates to include attachment references.
4. Security, observability, and compatibility controls.

**Phase 2 Tasks**
1. API contract design.
   - Add upload endpoint: POST /api/chat/attachments/upload (multipart/form-data).
   - Return attachment descriptors: id, filename, mime_type, size, checksum, storage_key, expires_at.
   - Add fetch endpoint for authorized preview/download by attachment id.
2. Chat request schema extension.
   - Add attachments field to /api/chat/quick and websocket payloads.
   - Each attachment entry should include id, filename, mime_type, size, reference_uri.
   - Keep message text payload unchanged for backward compatibility.
3. Storage strategy.
   - Use scoped per-user attachment storage namespace.
   - TTL cleanup for temporary files (e.g., 24h default).
   - Add optional pin/persist behavior for workspace-linked files.
4. Validation and limits.
   - MIME allowlist and extension verification.
   - Max file count per message and max aggregate size.
   - Per-file size limits by type (images/docs/pdf).
   - Virus scanning hook (if available in deployment stack).
5. Content extraction pipeline.
   - Text extraction for md/txt/pdf on backend.
   - Image metadata extraction and optional vision captioning hook.
   - Provide extracted summaries to LLM context, not raw binary blobs.
6. Prompt assembly changes.
   - Build model context from stored attachment references and extracted text.
   - Add truncation strategy and token budget controls.
7. Frontend UX enhancements.
   - Upload progress states and retry controls.
   - Attachment status badges: queued, uploading, ready, failed.
   - Remove/replace attachment before send.
8. Security and authorization.
   - Ensure attachment access is user-scoped and conversation-scoped.
   - Avoid exposing raw storage paths in client responses.
   - Enforce auth for upload/download/reference usage.
9. Migration and fallback.
   - Feature flag: useAttachmentRefs.
   - If upload fails, fallback to Phase 1 inline behavior for supported docs.
   - Keep existing clients functional without attachments field.
10. Telemetry and diagnostics.
    - Log upload timing, extraction timing, parse success/failure.
    - Include attachment usage metrics in chat telemetry.

**Risks**
1. Large PDFs can blow extraction/token budgets.
2. Upload latency may degrade chat responsiveness.
3. Storage growth and cleanup reliability can become operational burden.
4. Provider-specific multimodal behavior may differ across clouds.

**Mitigations**
1. Strict size/type limits and aggressive truncation.
2. Asynchronous extraction with clear UI states.
3. Scheduled cleanup jobs with monitoring/alerts.
4. Provider capability map and graceful fallback when multimodal unsupported.

**Verification**
1. Upload allowed files in LiteChat and Workspace; verify reference-based send success.
2. Confirm unauthorized users cannot fetch others' attachments.
3. Validate extraction for md/txt/pdf and behavior on unsupported files.
4. Validate fallback to inline mode when feature flag disabled or upload fails.
5. Validate cleanup removes expired temporary attachments.
