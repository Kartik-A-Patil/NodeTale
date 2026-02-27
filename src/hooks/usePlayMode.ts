import { useState, useEffect, useCallback, useRef } from "react";
import { Project, Variable, VariableType, AppNode } from "../types";
import { evaluateCondition } from "../services/logicService";

interface HistoryItem {
  nodeId: string;
  variables: Variable[];
}

export const usePlayModeLogic = (
  project: Project,
  startNodeId?: string | null
) => {
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [runtimeVars, setRuntimeVars] = useState<Variable[]>(
    JSON.parse(JSON.stringify(project.variables))
  );
  const [initialStartNodeId, setInitialStartNodeId] = useState<string | null>(
    null
  );

  const executedNodeIdRef = useRef<string | null>(null);

  // Initialize start node
  useEffect(() => {
    const board =
      project.boards.find((b) => b.id === project.activeBoardId) ||
      project.boards[0];
    if (board && board.nodes.length > 0) {
      let startNode;
      if (startNodeId) {
        startNode = board.nodes.find((n) => n.id === startNodeId);
      } else {
        startNode = board.nodes.find(
          (n) => n.data.label.toLowerCase() === "start"
        );
      }
      if (startNode) {
        setCurrentNodeId(startNode.id);
        setInitialStartNodeId(startNode.id);
      }
    }
  }, [startNodeId, project.boards, project.activeBoardId]);

  const findNode = (id: string) => {
    for (const board of project.boards) {
      const found = board.nodes.find((n) => n.id === id);
      if (found) return { node: found, board };
    }
    return null;
  };

  const currentNodeContext = currentNodeId ? findNode(currentNodeId) : null;
  const currentNode = currentNodeContext?.node;
  const currentBoard = currentNodeContext?.board;

  const toJSValue = (variable: Variable) => {
    if (variable.type === VariableType.ARRAY) {
      const val = variable.value as any;
      return Array.isArray(val?.elements) ? [...val.elements] : [];
    }

    if (variable.type === VariableType.OBJECT) {
      const obj = variable.value as any;
      if (obj && typeof obj === "object" && obj.keys) {
        return Object.fromEntries(
          Object.entries(obj.keys).map(([k, v]: any) => [k, v.value])
        );
      }
      return {};
    }

    return variable.value;
  };

  const toArrayValue = (jsValue: any, prev: Variable): any => {
    const prevVal: any = prev.value;
    const elementType = prevVal?.elementType || VariableType.STRING;
    if (!Array.isArray(jsValue)) {
      return prevVal?.elements ? { elementType, elements: [...prevVal.elements] } : { elementType, elements: [] };
    }
    return { elementType, elements: [...jsValue] };
  };

  const toObjectValue = (jsValue: any, prev: Variable): any => {
    const prevVal: any = prev.value;
    const entries =
      jsValue && typeof jsValue === "object" && !Array.isArray(jsValue)
        ? Object.entries(jsValue)
        : [];

    const keys = entries.reduce((acc: any, [k, v]) => {
      let type = VariableType.STRING;
      if (typeof v === "boolean") type = VariableType.BOOLEAN;
      else if (typeof v === "number") type = VariableType.NUMBER;
      acc[k] = { type, value: v };
      return acc;
    }, {} as Record<string, any>);

    return { keys: Object.keys(keys).length ? keys : prevVal?.keys || {} };
  };

  const executeNodeScript = useCallback(
    (content: string) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "text/html");
      const preBlocks = doc.querySelectorAll("pre");

      if (preBlocks.length === 0) return;

      // Collect the combined code from all <pre> blocks
      const code = Array.from(preBlocks)
        .map((block) => block.textContent || block.innerText || "")
        .join("\n");

      // Build an execution scope from runtime variables
      const scope: Record<string, any> = {};
      runtimeVars.forEach((variable) => {
        scope[variable.name] = toJSValue(variable);
      });

      const runner = new Function(
        "vars",
        "console",
        `try { with (vars) { ${code} } return { vars }; } catch (err) { console.warn('[PlayMode] Script error', err); return { vars, error: err?.message }; }`
      );

      const result = runner(scope, console);

      if (result?.error) {
        console.warn("[PlayMode] Script runtime error:", result.error);
      }

      const newRuntimeVars = runtimeVars.map((v) => {
        if (!(v.name in result.vars)) return v;
        const updated = result.vars[v.name];

        if (v.type === VariableType.ARRAY) {
          return { ...v, value: toArrayValue(updated, v) };
        }

        if (v.type === VariableType.OBJECT) {
          return { ...v, value: toObjectValue(updated, v) };
        }

        return { ...v, value: updated };
      });

      // Detect any change by shallow compare
      const hasUpdates = newRuntimeVars.some((v, idx) => v.value !== runtimeVars[idx].value);
      if (hasUpdates) {
        setRuntimeVars(newRuntimeVars);
      }
    },
    [runtimeVars]
  );

  useEffect(() => {
    if (!currentNode || !currentBoard) return;

    // Prevent re-execution on the same node
    if (executedNodeIdRef.current === currentNode.id) return;
    executedNodeIdRef.current = currentNode.id;

    if (currentNode.type === "elementNode") {
      executeNodeScript(currentNode.data.content);
    }

    if (currentNode.type === "jumpNode") {
      if (currentNode.data.jumpTargetId) {
        setHistory((h) => [...h, { nodeId: currentNodeId!, variables: JSON.parse(JSON.stringify(runtimeVars)) }]);
        setCurrentNodeId(currentNode.data.jumpTargetId);
      }
    } else if (currentNode.type === "conditionNode") {
      const branches = currentNode.data.branches || [];
      let targetHandleId = "else";

      for (const branch of branches) {
        if (branch.label === "Else") {
          targetHandleId = branch.id;
          continue;
        }
        if (evaluateCondition(branch.condition, runtimeVars)) {
          targetHandleId = branch.id;
          break;
        }
      }

      const edge = currentBoard.edges.find(
        (e) => e.source === currentNode.id && e.sourceHandle === targetHandleId
      );

      if (edge) {
        setHistory((h) => [...h, { nodeId: currentNodeId!, variables: JSON.parse(JSON.stringify(runtimeVars)) }]);
        setCurrentNodeId(edge.target);
      }
    }
  }, [currentNodeId, currentNode, currentBoard, executeNodeScript, runtimeVars]);

  const getOptions = () => {
    if (!currentNode || !currentBoard || currentNode.type !== "elementNode")
      return [];

    const edges = currentBoard.edges.filter((e) => e.source === currentNode.id);

    return edges
      .map((edge) => {
        const target = currentBoard.nodes.find((n) => n.id === edge.target);
        return {
          label: target?.data.label || "Continue",
          targetId: target?.id,
        };
      })
      .filter((opt): opt is { label: string; targetId: string } => !!opt.targetId);
  };

  const handleOptionClick = (targetId: string) => {
    setHistory([...history, { nodeId: currentNodeId!, variables: JSON.parse(JSON.stringify(runtimeVars)) }]);
    setCurrentNodeId(targetId);
  };

  const goBack = () => {
    if (history.length === 0) return;

    const newHistory = [...history];
    let prevItem = newHistory.pop();

    // Skip logic nodes to find the last interactive node
    while (prevItem) {
       const nodeContext = findNode(prevItem.nodeId);
       if (nodeContext && nodeContext.node.type === 'elementNode') {
           break;
       }
       if (newHistory.length === 0) break;
       prevItem = newHistory.pop();
    }

    if (prevItem) {
        setHistory(newHistory);
        setCurrentNodeId(prevItem.nodeId);
        setRuntimeVars(prevItem.variables);
        executedNodeIdRef.current = prevItem.nodeId;
    }
  };

  const restart = () => {
    executedNodeIdRef.current = null;
    setCurrentNodeId(initialStartNodeId);
    setRuntimeVars(JSON.parse(JSON.stringify(project.variables)));
    setHistory([]);
  };

  return {
    currentNode,
    runtimeVars,
    getOptions,
    handleOptionClick,
    restart,
    goBack,
    canGoBack: history.length > 0,
    projectAssets: project.assets,
  };
};
