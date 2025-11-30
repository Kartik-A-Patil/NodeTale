import { useState, useEffect, useCallback } from "react";
import { Project, Variable, VariableType, AppNode } from "../types";
import { evaluateCondition } from "../services/logicService";

export const usePlayModeLogic = (
  project: Project,
  startNodeId?: string | null
) => {
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [runtimeVars, setRuntimeVars] = useState<Variable[]>(
    JSON.parse(JSON.stringify(project.variables))
  );
  const [initialStartNodeId, setInitialStartNodeId] = useState<string | null>(
    null
  );

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

  const executeNodeScript = useCallback(
    (content: string) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "text/html");
      const preBlocks = doc.querySelectorAll("pre");

      if (preBlocks.length === 0) return;

      const newRuntimeVars = [...runtimeVars];
      let hasUpdates = false;

      preBlocks.forEach((block) => {
        const text = block.innerText;
        const lines = text.split("\n");

        lines.forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;

          let operator = "";
          if (trimmed.includes("=")) operator = "=";

          if (!operator) return;

          const [left, right] = trimmed.split("=").map((s) => s.trim());
          const targetVarIndex = newRuntimeVars.findIndex(
            (v) => v.name === left
          );

          if (targetVarIndex !== -1) {
            const targetVar = newRuntimeVars[targetVarIndex];
            let newValue: any = right;

            if (targetVar.type === VariableType.NUMBER) {
              newValue = Number(right);
            } else if (targetVar.type === VariableType.BOOLEAN) {
              newValue = right === "true";
            } else {
              newValue = right.replace(/['"]/g, "");
            }

            if (!isNaN(newValue) || targetVar.type !== VariableType.NUMBER) {
              newRuntimeVars[targetVarIndex] = {
                ...targetVar,
                value: newValue,
              };
              hasUpdates = true;
            }
          }
        });
      });

      if (hasUpdates) {
        setRuntimeVars(newRuntimeVars);
      }
    },
    [runtimeVars]
  );

  useEffect(() => {
    if (!currentNode || !currentBoard) return;

    if (currentNode.type === "elementNode") {
      executeNodeScript(currentNode.data.content);
    }

    if (currentNode.type === "jumpNode") {
      if (currentNode.data.jumpTargetId) {
        setHistory((h) => [...h, currentNodeId!]);
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
        setHistory((h) => [...h, currentNodeId!]);
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
    setHistory([...history, currentNodeId!]);
    setCurrentNodeId(targetId);
  };

  const restart = () => {
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
    projectAssets: project.assets,
  };
};
