---
id: iim-integration
title: IIM Platform Integration Overview
sidebar_position: 1
---

This document captures the high-level plan for adapting Xplorer to operate against the Investigation Information Management (IIM) platform instead of the local filesystem. The effort is split into phased deliveries so that core functionality can be validated with investigators early and the integration risk can be contained.

## Phase 1 – Foundation & API Integration (2–3 weeks)

### Project setup
- Fork Xplorer and establish the development environment (Node, Yarn, Tauri runtime).
- Configure the desktop build pipeline so that the integrated client can be packaged for Windows/macOS/Linux using Tauri.

### API abstraction layer
- Introduce an `IIMApiClient` that mirrors the contracts from `IIM.Shared` and replaces direct filesystem access with REST calls.
- Surface a mock implementation to unblock UI development before the C# backend is available.
- Integrate the client inside `DirectoryAPI` so that paths beginning with `workspace://` are automatically routed to the virtual workspace service.

### Authentication
- Authenticate with username/password to receive short-lived API tokens and refresh tokens.
- Cache tokens securely (OS credential vault on desktop) and ensure silent refresh five minutes before expiration.
- Provide login/logout UI that reuses the existing Xplorer shell.

### Workspace/file access
- List available workspaces, hydrate the workspace sidebar, and navigate the virtual folder structure.
- Support file upload through the initiate/confirm transaction pattern, and expose downloads through short-lived pre-signed URLs.
- Present meaningful error states for API failures and offline mode.

**Deliverable:** the Xplorer fork can authenticate, enumerate workspaces, browse files, and upload/download evidence using the IIM API.

## Phase 2 – Virtual Folder Structure (2 weeks)

### Workspace navigation
- Replace the traditional filesystem tree with the workspace hierarchy (`workspace://{workspaceId}/…`).
- Add a workspace switcher, recently accessed workspaces, and dedicated sections such as Primary Evidence, Quarantine, and Derived Exports.
- Implement virtual folders backed by API data while maintaining Xplorer’s interaction model (breadcrumbs, multi-tab browsing, favorites).

### Metadata-rich views
- Extend the properties panel with tags, sensitivity, quarantine status, hash information, deduplication links, and chain-of-custody timelines.
- Allow authorized users to edit metadata and surface status indicators through badges, colors, and icons.

### Search
- Replace the filesystem search with the API-backed search endpoint.
- Expose advanced filters (tags, sensitivity, file types, date ranges, hash values, case numbers, OCR content) and support saved searches and history.

**Deliverable:** complete virtual folder navigation with rich metadata rendering and advanced search.

## Phase 3 – Investigation Workflow (2 weeks)

### Bulk operations and relationships
- Provide batch tagging, sensitivity changes, and workspace moves (e.g., Quarantine → Primary Evidence).
- Visualize file relationships, parent/child containers, processed derivatives, and duplicate clusters.

### Quarantine workflow
- Implement a quarantine review queue with approve/reject actions, comments, and optional dual-control approvals.
- Display quarantine health via dashboards and visual markers in the file list.

### Tag management & pipeline visibility
- Allow hierarchical tag creation, suggestions from analysis, and bulk tag operations.
- Surface real-time pipeline state (SignalR/WebSockets) for ingestion, analysis completion, hash computation, and retry controls.

**Deliverable:** fully supported investigation workflows with quarantine management, tagging, and live pipeline telemetry.

## Phase 4 – Collaboration & Administration (2 weeks)

### Workspace collaboration
- Invite/assign users to workspaces with Owner/Member/Viewer roles.
- Track activity (recent changes, active investigators) and deliver notifications for relevant updates.

### Comments and annotations
- Enable file-level discussions, threaded comments, @mentions, and moderation controls.

### Administration
- Provide system health dashboards (storage usage, queue backlog, error rates) and user/license management.
- Offer an audit log browser with granular filtering.

**Deliverable:** collaboration tooling, admin dashboards, and full user management capabilities.

## Phase 5 – Advanced Features & Polish (1–2 weeks)

### Visualization and analytics
- Timeline, relationship, and geographic visualizations based on evidence metadata.
- File type analytics, charts, and case-level insights.

### Reporting & export
- Build investigation packages (files + metadata) for court submission, including chain-of-custody reports and standard formats (ZIP, E01, etc.).
- Provide a custom report builder and evidence summary generator.

### Performance & cross-platform
- Optimize for large datasets with lazy loading and infinite scroll.
- Add keyboard shortcuts, drag & drop refinements, context menu customization, and dark/light themes.
- Validate across Windows/macOS/Linux and outline an offline capability strategy.

**Deliverable:** production-ready experience with advanced visualization, reporting, and performance improvements.

## Technical considerations

- **State management:** reuse Xplorer storage for UI preferences while caching workspace context and metadata securely. Plan for offline caching of frequently accessed evidence.
- **Error handling:** degrade gracefully during API outages, surface investigator-friendly messages, and add retry logic for transient failures.
- **Security:** enforce role-based UI controls, short-lived pre-signed URLs, and audit logging for every action.
- **Success metrics:**
  - Phase 1 – authentication and workspace browsing in the integrated client.
  - Phase 2 – navigation of virtual folders with metadata.
  - Phase 3 – evidence workflow operations.
  - Phase 4 – collaboration capabilities.
  - Phase 5 – performance, reporting, and platform coverage.
- **Risk mitigation:** decouple the API client for easier backend changes, implement pagination/lazy loading early, continuously test on all target OSes, and retain familiar Xplorer UX patterns to drive adoption.
