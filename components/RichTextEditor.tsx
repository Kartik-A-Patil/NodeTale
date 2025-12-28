import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Code,
  List,
  Quote
} from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import { Variable } from "../types";
// Note: syntax highlighting in the editor was removed to avoid duplicated markup glitches
// when switching between edit/view states. Highlighting now happens only in the read-only view.

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
    onMouseDown={(e) => e.preventDefault()}
  >
    {icon}
  </button>
);

const sanitizeHtmlContent = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");

  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
};

// Remove previous variable highlight spans so we don't nest them
const stripHighlightSpans = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  doc.querySelectorAll('span[data-variable]').forEach((span) => {
    const textNode = doc.createTextNode(span.textContent || "");
    span.replaceWith(textNode);
  });
  return doc.body.innerHTML;
};


const highlightVariablesSafe = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");

  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        let parent = node.parentElement;
        while (parent) {
          if (parent.tagName.toLowerCase() === "pre") {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const replacements: { node: Text; frag: DocumentFragment }[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.nodeValue || "";
    const parts = text.split(/(\{\{[^}]+\}\})/);

    if (parts.length > 1) {
      const frag = doc.createDocumentFragment();
      parts.forEach((part) => {
        if (/\{\{[^}]+\}\}/.test(part)) {
          const name = part.slice(2, -2).trim();
          const span = doc.createElement("span");
          span.setAttribute("data-variable", name);
          span.setAttribute("style", "color: #8c8c8c;");
          span.textContent = part;
          frag.appendChild(span);
        } else {
          frag.appendChild(doc.createTextNode(part));
        }
      });
      replacements.push({ node, frag });
    }
  }

  replacements.forEach(({ node, frag }) => {
    node.parentNode?.replaceChild(frag, node);
  });

  return doc.body.innerHTML;
};

const highlightCodeBlocks = (html: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");

  doc.querySelectorAll("pre").forEach((pre) => {
    const codeText = pre.textContent || "";
    const highlighted = Prism.highlight(codeText, Prism.languages.javascript, "javascript");
    pre.classList.add("language-javascript");
    pre.innerHTML = highlighted;
  });

  return doc.body.innerHTML;
};

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
  const isUpdatingRef = useRef(false);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      const cleanValue = sanitizeHtmlContent(initialValue);
      const withCode = highlightCodeBlocks(cleanValue);
      const highlighted = highlightVariablesSafe(withCode);
      editorRef.current.innerHTML = highlighted;
      
      // Focus automatically when mounted
      editorRef.current.focus();
      setIsFocused(true);
      
      // Move cursor to end
      try {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch (e) {
        console.error("Failed to set cursor position", e);
      }
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
    if (editorRef.current && !isUpdatingRef.current) {
      const rawContent = editorRef.current.innerHTML;
      const cleanContent = sanitizeHtmlContent(stripHighlightSpans(rawContent));

      onChange(cleanContent);
      checkFormats();

      // Debounce highlighting to avoid cursor jumps while typing
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => {
        applyHighlighting();
      }, 150);
    }
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

    // ExecCommand does not always trigger an input event, so sync manually
    handleInput();
  };

  const saveCursorPosition = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return null;

    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    return preCaretRange.toString().length;
  };

  const restoreCursorPosition = (position: number) => {
    if (!editorRef.current) return;

    const sel = window.getSelection();
    if (!sel) return;

    let charCount = 0;
    const nodeStack: Node[] = [editorRef.current];
    let foundNode: Node | null = null;
    let foundOffset = 0;

    while (nodeStack.length > 0 && !foundNode) {
      const node = nodeStack.pop()!;

      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        if (charCount + textLength >= position) {
          foundNode = node;
          foundOffset = position - charCount;
        } else {
          charCount += textLength;
        }
      } else {
        const children = Array.from(node.childNodes);
        for (let i = children.length - 1; i >= 0; i--) {
          nodeStack.push(children[i]);
        }
      }
    }

    if (foundNode) {
      try {
        const range = document.createRange();
        range.setStart(foundNode, foundOffset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
        // Ignore cursor restoration errors
      }
    }
  };

  const applyHighlighting = () => {
    if (editorRef.current && !isUpdatingRef.current) {
      const cursorPos = saveCursorPosition();

      const rawContent = editorRef.current.innerHTML;
      const cleanContent = sanitizeHtmlContent(stripHighlightSpans(rawContent));
      const withCode = highlightCodeBlocks(cleanContent);
      const highlighted = highlightVariablesSafe(withCode);

      if (editorRef.current.innerHTML !== highlighted) {
        isUpdatingRef.current = true;
        editorRef.current.innerHTML = highlighted;

        if (cursorPos !== null) {
          restoreCursorPosition(cursorPos);
        }

        isUpdatingRef.current = false;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    // Check if we're inside a <pre> block
    const sel = window.getSelection();
    if (e.key === "Enter" && sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      let node = range.commonAncestorContainer;
      
      // Traverse up to find if we're in a <pre> element
      while (node && node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentNode!;
      }
      
      let inPre = false;
      let preElement: Element | null = null;
      let parent = node as Element | null;
      while (parent) {
        if (parent.tagName?.toLowerCase() === "pre") {
          inPre = true;
          preElement = parent;
          break;
        }
        parent = parent.parentElement;
      }
      
      // If inside <pre>, exit code block and start normal text
      if (inPre && preElement) {
        e.preventDefault();
        // Insert a new paragraph after the <pre> block
        const newPara = document.createElement("div");
        newPara.innerHTML = "<br>";
        preElement.parentNode?.insertBefore(newPara, preElement.nextSibling);
        
        // Move cursor to the new paragraph
        const range = document.createRange();
        range.setStart(newPara, 0);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
        
        handleInput();
      }
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col group">
      {/* Floating Context Menu Toolbar */}
      <div
        className={`nodrag absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#1e1e20] border border-[#27272a] rounded-lg shadow-2xl p-1.5 z-50 transition-opacity duration-200 ${
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
        className="nodrag markdown-content w-full h-full bg-transparent border-none outline-none text-zinc-300 text-xs whitespace-pre-wrap overflow-auto cursor-text"
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={(e) => e.stopPropagation()}
        onCopy={(e) => e.stopPropagation()}
        onCut={(e) => e.stopPropagation()}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
            setIsFocused(false);
            onBlur();
        }}
        onMouseUp={checkFormats}
        onKeyUp={checkFormats}
      />
      <style>{`
   
        .markdown-content pre:empty::before {
          content: '';
          white-space: pre-wrap;
          display: block;
        }
      `}</style>
    </div>
  );
};
