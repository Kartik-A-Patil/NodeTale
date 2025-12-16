# Copilot / AI Agent Instructions for NodeTale

Keep this short and focused — the goal is to make an AI coding agent immediately productive.

- **Project type:** React + TypeScript app built with Vite. Uses `reactflow` for node/edge canvas and Tailwind-style utility classes in components.
- **Start / Build:** `bun install` then `bun run dev` (Vite dev server). Production build: `bun run build` and `bun run preview`.

- **Key directories:**
  - `components/` — UI building blocks; main app pieces are `TopToolbar.tsx`, `SidebarLeft.tsx`, `RichTextEditor.tsx`.
  - `components/nodes/` — React Flow custom nodes (e.g. `AnnotationNode.tsx`, `CommentNode.tsx`, `JumpNode.tsx`). These use `NodeProps<NodeData>` and `useReactFlow`.
  - `edge/` — custom edge components (e.g. `FloatingEdge.tsx`).
  - `hooks/` — project hooks that encapsulate behavior (e.g. `useProjectState.ts`, `useFlowLogic.ts`, `useDragAndDrop.ts`, `useContextMenu.ts`). Prefer adding behavior here rather than scattering global state.
  - `services/` — non-UI logic: `logicService.ts` (flow/board logic) and `storageService.ts` (persistence). Call these for side-effects and IO.
  - `utils/` — helper functions (examples: `EdgeUtils.ts`, `projectUtils.ts`).

- **Central data model:** `types.ts` defines `NodeData`, `AppNode`, `Board`, `Project`. Always update `types.ts` when adding node properties. `NodeData` is the canonical shape for nodes (fields like `label`, `content`, `color`, `branches`, `jumpTargetId`).

- **React Flow conventions:**
  - Nodes are React components in `components/nodes/` and receive `NodeProps<NodeData>`.
  - Node updates use `useReactFlow().setNodes(...)` — see `AnnotationNode.tsx` which updates a node via `setNodes(nds => nds.map(n => n.id===id ? {...n, data:{...n.data, [field]: value}} : n))`.
  - Custom edges live in `edge/` and are referenced when constructing the flow elements.

- **State & logic separation:**
  - UI components read/write state via hooks in `hooks/` (e.g. `useProjectState.ts`).
  - Business logic and persistence belong in `services/` (call these from hooks or effect handlers).

- **Styling:** Utility-first classes (Tailwind-style) are used directly on elements. Do not expect a central CSS file; prefer small, local class changes unless refactoring.

- **Common patterns & gotchas:**
  - Components are memoized (`export default memo(...)`) to reduce re-renders — respect props equality when changing APIs.
  - Nodes frequently use `autoFocus` and inline editing (double-click to edit). Keep keyboard handlers minimal and consistent.
  - When changing node shape, update all node components and the `types.ts` `NodeData` interface.
  - There are no test suites in the repo root — assume manual verification via the dev server.

- **External deps to be aware of:** `reactflow`, `@xyflow/react`, `react-router-dom`, `lucide-react`. Many components rely on TypeScript types exported from `reactflow`.

- **PR / change guidance for AI agents:**
  - Keep changes focused to a single concern (UI, hook, or service). Update `types.ts` for any shape changes.
  - Add or update a single sample node or hook usage when showing new patterns.
  - Run `bun run dev` locally to sanity-check UI changes (HMR works via Vite).

If anything in this file looks incomplete or you want more examples (e.g. common hook usages or typical service flows), tell me which area and I will expand with concrete code snippets and references.
