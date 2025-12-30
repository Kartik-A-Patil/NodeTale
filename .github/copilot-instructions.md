# Copilot / AI Agent Instructions for NodeTale

## Project Overview
NodeTale is a React + TypeScript visual node-based story editor built with Vite. It uses `reactflow` (@xyflow/react) for interactive node canvas editing, with projects persisting to IndexedDB. The app enables creating interactive branching narratives with variables, conditions, and rich text content.

## Quick Start
- **Dev:** `bun install` → `bun run dev` (Vite HMR on port 5173)
- **Build:** `bun run build` → `bun run preview`
- **Key tech:** React 19, ReactFlow 11/12, React Router 7, Tailwind 3, Bun runtime

## Architecture & Data Flow

### Core Data Model (`types.ts`)
- **Project** → contains multiple **Boards** (think: chapters/scenes)
- **Board** → contains **AppNode[]** (ReactFlow nodes) + **Edge[]**
- **NodeData** → unified interface for all node types with fields: `label`, `content` (HTML), `assets`, `variables`, `branches`, `jumpTargetId`, `color`, `date`
- **Variable** → typed state (string/number/boolean/array/object) with project-wide scope
- **Asset** → images/audio/video stored in IndexedDB with file path references

**Critical:** Always update `types.ts` when adding node properties. `NodeData` is the single source of truth for node shape.

### State Management Pattern
1. **`useFlowLogic`** (main hook) → manages nodes/edges state via `useNodesState`/`useEdgesState`, undo/redo stack, clipboard
2. **`useProjectState`** → syncs ReactFlow state ↔ `Project` object ↔ IndexedDB, handles board switching
3. **`App.tsx`** → orchestrates hooks, passes down via props (no global context)

**Board switching flow:** When user switches boards, `useProjectState` saves current board's nodes/edges to Project, then loads new board's nodes/edges into ReactFlow. See [useProjectState.ts](hooks/useProjectState.ts#L71-L99).

### Persistence (`services/storageService.ts`)
- **IndexedDB** stores: projects (object store: `projects`) + assets (object store: `assets`)
- Auto-save triggers on node/edge changes (debounced in `useProjectState`)
- Assets stored as Blob URLs, metadata in Project.assets array
- Dashboard loads all projects via `loadAllProjects()` → displays in grid

### Node System
**Custom nodes** in `components/nodes/` are registered in [flowConfig.ts](components/flowConfig.ts):
- **ElementNode** — standard story content with rich text
- **ConditionNode** — branches based on variable conditions (uses `logicService.evaluateCondition`)
- **JumpNode** — teleports to another node (cross-board support)
- **CommentNode** — non-interactive annotations
- **SectionNode** — visual grouping/dividers
- **AnnotationNode** — floating labels with arrow direction

**Node update pattern** (from [AnnotationNode.tsx](components/nodes/AnnotationNode.tsx#L16-L30)):
```tsx
const { setNodes } = useReactFlow();
setNodes((nds) =>
  nds.map((node) => 
    node.id === id 
      ? { ...node, data: { ...node.data, [field]: value } }
      : node
  )
);
```

### Rich Text Editing (`RichTextEditor.tsx`)
- Inline editing with toolbar (bold, italic, code blocks, lists)
- **Code blocks** (`<pre>`) parsed as executable scripts in Play Mode
- Syntax highlighting via Prism.js + custom variable name highlighting
- Variable interpolation: `{{variableName}}` replaced at runtime

### Play Mode (`usePlayMode.ts`)
- Runtime execution engine: starts from "Start" node, evaluates conditions, executes scripts
- **Script execution:** Parses `<pre>` blocks for variable assignments (`varName = value`)
- **Condition evaluation:** Uses `logicService.evaluateCondition` for branch logic
- **Jump targets:** Searches across all boards for target node ID
- Runtime variables (`runtimeVars`) are deep-cloned from project.variables at play start

## Critical Workflows

### Adding a New Node Type
1. Create component in `components/nodes/MyNode.tsx` with `NodeProps<NodeData>`
2. Register in [flowConfig.ts](components/flowConfig.ts) nodeTypes object
3. Add drag handler in `useDragAndDrop.ts` onDrop
4. Update `NodeData` in [types.ts](types.ts) if new fields needed
5. Handle in Play Mode if it affects runtime behavior

### Modifying Project Structure
1. Update `Project` type in [types.ts](types.ts)
2. Increment `DB_VERSION` in [storageService.ts](services/storageService.ts#L6) if schema changes
3. Add migration logic in `onupgradeneeded` handler if breaking change
4. Test by creating new project + loading existing projects

### Debugging State Issues
- Check browser console for `[useProjectState]` logs (board loading/saving)
- IndexedDB inspector: Application tab → IndexedDB → NodeTaleDB
- React Flow internals: `reactFlowInstance.toObject()` for full state snapshot
- Undo/redo stack in `useFlowLogic`: `past`/`future` arrays

## Common Patterns & Gotchas

### Memoization
All node components use `export default memo(...)` — ensure props don't change on every render. Avoid passing new object/array literals directly.

### Double-click to Edit
Pattern across nodes: `onDoubleClick={() => setEditingField('label')}` → renders input → `onBlur` or `Enter` to commit. See [AnnotationNode.tsx](components/nodes/AnnotationNode.tsx#L67-L82).

### Asset References
Nodes store **asset IDs only** in `data.assets: string[]`, not full Asset objects. Lookup via `project.assets.find(a => a.id === assetId)`. See [AssetSelectorModal.tsx](components/AssetSelectorModal.tsx).

### Undo/Redo
Snapshots taken before mutations via `takeSnapshot()` in `useFlowLogic`. Max 50 history entries. Keyboard shortcuts: `Cmd/Ctrl+Z` (undo), `Cmd/Ctrl+Shift+Z` (redo).

### Logic Service
- **`evaluateCondition(conditionStr, variables)`** — basic parser for `varName == value`, supports `==`, `!=`, `>`, `<`
- **`replaceVariablesInText(text, variables)`** — replaces `{{varName}}` with values
- Array methods: `arrayMap`, `arrayFilter`, `arrayReduce` — operates on `ArrayValue` type

## External Dependencies
- **reactflow / @xyflow/react** — both v11 (legacy) and v12 (current) imports exist; prefer @xyflow
- **react-router-dom v7** — file-based routing: `/` (Dashboard), `/project/:projectId` (Editor)
- **lucide-react** — icon library for UI
- **Prism.js** — syntax highlighting in RichTextEditor
- **@monaco-editor/react** — used in variable/script editors

## Testing & Verification
No automated test suite — manual verification via dev server. Key test scenarios:
1. Create project → add nodes → switch boards → verify persistence
2. Play Mode → test condition branches, variable updates, jump nodes
3. Asset upload → verify IndexedDB storage, display in nodes
4. Undo/redo → multi-step changes, board switching

## Change Guidelines
- **Single concern:** UI, hook, OR service — don't mix layers in one PR
- **Type safety:** Update `types.ts` first for structural changes, let TS guide you
- **Verify HMR:** Changes should hot-reload without full page refresh (Vite magic)
- **Console logs:** Prefix with component/hook name: `[useProjectState] Loading...`

## Reference Files
- [types.ts](types.ts) — data model source of truth
- [useFlowLogic.ts](hooks/useFlowLogic.ts) — main state orchestration
- [useProjectState.ts](hooks/useProjectState.ts) — persistence layer
- [logicService.ts](services/logicService.ts) — runtime evaluation engine
- [App.tsx](App.tsx) — top-level component composition
