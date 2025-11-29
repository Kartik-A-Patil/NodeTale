import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Code,
  List,
  Quote
} from "lucide-react";
import { Variable } from "../types";

// Helper: Save cursor position relative to text content
const saveCaretPosition = (context: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const preSelectionRange = range.cloneRange();
  preSelectionRange.selectNodeContents(context);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  return preSelectionRange.toString().length;
};

// Helper: Restore cursor position
const restoreCaretPosition = (context: HTMLElement, pos: number) => {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStart(context, 0);
  range.collapse(true);

  const nodeStack: Node[] = [context];
  let node: Node | undefined;
  let foundStart = false;
  let stop = false;
  let charIndex = 0;

  while (!stop && (node = nodeStack.pop())) {
    if (node.nodeType === 3) {
      const nextCharIndex = charIndex + (node.nodeValue?.length || 0);
      if (!foundStart && pos >= charIndex && pos <= nextCharIndex) {
        range.setStart(node, pos - charIndex);
        range.collapse(true);
        stop = true;
      }
      charIndex = nextCharIndex;
    } else {
      let i = node.childNodes.length;
      while (i--) {
        nodeStack.push(node.childNodes[i]);
      }
    }
  }

  selection.removeAllRanges();
  selection.addRange(range);
};

const ToolbarButton = ({
  icon,
  onClick,
  isActive
}: {
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  isActive?: boolean;
}) => (
  <button
    className={`p-1.5 rounded transition-colors ${
      isActive
        ? "bg-zinc-600 text-white shadow-inner"
        : "text-zinc-400 hover:text-white hover:bg-zinc-700"
    }`}
    onClick={onClick}
  >
    {icon}
  </button>
);

export const RichTextEditor = ({
  initialValue,
  onChange,
  onBlur,
  variables
}: {
  initialValue: string;
  onChange: (val: string) => void;
  onBlur: () => void;
  variables?: Variable[];
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialValue;
      // Initial Highlight
      const highlighted = processSyntaxHighlighting(initialValue);
      if (highlighted !== initialValue) {
        editorRef.current.innerHTML = highlighted;
      }
      // Focus automatically when mounted if it's intended to be editing immediately
      editorRef.current.focus();
      setIsFocused(true);
    }
  }, []);

  const checkFormats = () => {
    const formats: string[] = [];
    if (document.queryCommandState("bold")) formats.push("bold");
    if (document.queryCommandState("italic")) formats.push("italic");
    if (document.queryCommandState("underline")) formats.push("underline");
    if (document.queryCommandState("insertUnorderedList")) formats.push("list");

    const block = document.queryCommandValue("formatBlock");
    if (block === "blockquote") formats.push("blockquote");
    if (block === "pre") formats.push("pre");

    setActiveFormats(formats);
  };

  const handleInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      onChange(content);
      checkFormats();

      // Real-time highlighting debounce
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        if (!editorRef.current) return;

        // Only attempt to highlight if we have a code block to avoid unnecessary DOM thrashing
        if (content.includes("<pre")) {
          const caretPos = saveCaretPosition(editorRef.current);
          const highlighted = processSyntaxHighlighting(
            editorRef.current.innerHTML
          );

          if (highlighted !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = highlighted;
            if (caretPos !== null) {
              restoreCaretPosition(editorRef.current, caretPos);
            }
          }
        }
      }, 600); // 600ms debounce for "while writing" feel without breaking cursor constantly
    }
  };

  const processSyntaxHighlighting = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;

    const pres = div.querySelectorAll("pre");
    if (pres.length === 0) return html;

    pres.forEach((pre) => {
      const rawText = pre.innerText;

      let safeText = rawText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

      // Highlight Operators
      safeText = safeText.replace(
        /([=+\-*/%&|<>!])/g,
        '<span class="text-white" style="color: #ffffff;">$1</span>'
      );

      // Highlight Numbers
      safeText = safeText.replace(
        /\b(\d+)\b/g,
        '<span class="text-purple-400" style="color: #a78bfa;">$1</span>'
      );

      // Highlight Variables
      if (variables && variables.length > 0) {
        const varNames = variables
          .map((v) => v.name)
          .sort((a, b) => b.length - a.length);
        const pattern = new RegExp(`\\b(${varNames.join("|")})\\b`, "g");

        safeText = safeText.replace(
          pattern,
          '<span class="text-blue-400 font-bold" style="color: #60a5fa;">$1</span>'
        );
      }

      pre.className = "text-zinc-400";
      pre.style.color = "#a1a1aa";
      pre.innerHTML = safeText;
    });

    return div.innerHTML;
  };

  const exec = (command: string, value: any = null) => {
    editorRef.current?.focus();

    if (command === "formatBlock") {
      const currentBlock = document.queryCommandValue("formatBlock");
      if (currentBlock && currentBlock.toLowerCase() === value.toLowerCase()) {
        document.execCommand("formatBlock", false, "div");
      } else {
        document.execCommand("formatBlock", false, value);
      }
    } else {
      document.execCommand(command, false, value);
    }

    checkFormats();
  };

  return (
    <div className="relative w-full h-full flex flex-col group">
      {/* Floating Context Menu Toolbar */}
      <div
        className={`nodrag absolute -top-[100px] left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#1e1e20] border border-[#27272a] rounded-lg shadow-2xl p-1.5 z-100 transition-opacity duration-200 ${
          isFocused ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onMouseDown={(e) => e.preventDefault()}
      >
        <ToolbarButton
          isActive={activeFormats.includes("bold")}
          icon={<Bold size={14} />}
          onClick={() => exec("bold")}
        />
        <ToolbarButton
          isActive={activeFormats.includes("italic")}
          icon={<Italic size={14} />}
          onClick={() => exec("italic")}
        />
        <ToolbarButton
          isActive={activeFormats.includes("underline")}
          icon={<Underline size={14} />}
          onClick={() => exec("underline")}
        />
        <div className="w-[1px] h-4 bg-zinc-700 mx-1" />
        <ToolbarButton
          isActive={activeFormats.includes("list")}
          icon={<List size={14} />}
          onClick={() => exec("insertUnorderedList")}
        />
        <ToolbarButton
          isActive={activeFormats.includes("blockquote")}
          icon={<Quote size={14} />}
          onClick={() => exec("formatBlock", "blockquote")}
        />
        <ToolbarButton
          isActive={activeFormats.includes("pre")}
          icon={<Code size={14} />}
          onClick={() => exec("formatBlock", "pre")}
        />
      </div>

      <div
        ref={editorRef}
        className="nodrag markdown-content w-full h-full bg-transparent border-none outline-none text-zinc-300 text-xs whitespace-pre-wrap overflow-y-auto cursor-text p-1"
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
            setIsFocused(false);
            onBlur();
        }}
        onMouseUp={checkFormats}
        onKeyUp={checkFormats}
        style={{ minHeight: "6rem" }}
      />
    </div>
  );
};
