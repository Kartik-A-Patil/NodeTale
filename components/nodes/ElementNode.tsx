import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { FileText, Image as ImageIcon, Bold, Italic, Underline, Code, List, Quote } from 'lucide-react';
import { NodeData, Variable } from '../../types';

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

const RichTextEditor = ({ 
    initialValue, 
    onChange, 
    onBlur, 
    variables 
}: { 
    initialValue: string, 
    onChange: (val: string) => void, 
    onBlur: () => void,
    variables?: Variable[]
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [activeFormats, setActiveFormats] = useState<string[]>([]);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = initialValue;
            // Initial Highlight
            const highlighted = processSyntaxHighlighting(initialValue);
            if (highlighted !== initialValue) {
                 editorRef.current.innerHTML = highlighted;
            }
        }
    }, []);

    const checkFormats = () => {
        const formats: string[] = [];
        if (document.queryCommandState('bold')) formats.push('bold');
        if (document.queryCommandState('italic')) formats.push('italic');
        if (document.queryCommandState('underline')) formats.push('underline');
        if (document.queryCommandState('insertUnorderedList')) formats.push('list');
        
        const block = document.queryCommandValue('formatBlock');
        if (block === 'blockquote') formats.push('blockquote');
        if (block === 'pre') formats.push('pre');
        
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
                if (content.includes('<pre')) {
                    const caretPos = saveCaretPosition(editorRef.current);
                    const highlighted = processSyntaxHighlighting(editorRef.current.innerHTML);
                    
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
        const div = document.createElement('div');
        div.innerHTML = html;
        
        const pres = div.querySelectorAll('pre');
        if (pres.length === 0) return html;

        pres.forEach(pre => {
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
                const varNames = variables.map(v => v.name).sort((a, b) => b.length - a.length);
                const pattern = new RegExp(`\\b(${varNames.join('|')})\\b`, 'g');
                
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
        
        if (command === 'formatBlock') {
            const currentBlock = document.queryCommandValue('formatBlock');
            if (currentBlock && currentBlock.toLowerCase() === value.toLowerCase()) {
                document.execCommand('formatBlock', false, 'div');
            } else {
                document.execCommand('formatBlock', false, value);
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
                className="nodrag absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#1e1e20] border border-[#27272a] rounded-lg shadow-2xl p-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto"
                onMouseDown={(e) => e.preventDefault()}
             >
                <ToolbarButton isActive={activeFormats.includes('bold')} icon={<Bold size={14}/>} onClick={() => exec('bold')} />
                <ToolbarButton isActive={activeFormats.includes('italic')} icon={<Italic size={14}/>} onClick={() => exec('italic')} />
                <ToolbarButton isActive={activeFormats.includes('underline')} icon={<Underline size={14}/>} onClick={() => exec('underline')} />
                <div className="w-[1px] h-4 bg-zinc-700 mx-1" />
                <ToolbarButton isActive={activeFormats.includes('list')} icon={<List size={14}/>} onClick={() => exec('insertUnorderedList')} />
                <ToolbarButton isActive={activeFormats.includes('blockquote')} icon={<Quote size={14}/>} onClick={() => exec('formatBlock', 'blockquote')} />
                <ToolbarButton isActive={activeFormats.includes('pre')} icon={<Code size={14}/>} onClick={() => exec('formatBlock', 'pre')} />
             </div>

             <div 
                ref={editorRef}
                className="nodrag markdown-content w-full h-full bg-transparent border-none outline-none text-zinc-300 text-xs whitespace-pre-wrap overflow-y-auto cursor-text p-1"
                contentEditable
                onInput={handleInput}
                onBlur={onBlur}
                onMouseUp={checkFormats}
                onKeyUp={checkFormats}
                style={{ minHeight: '6rem' }}
             />
        </div>
    );
};

const ToolbarButton = ({ icon, onClick, isActive }: { icon: React.ReactNode, onClick: (e: React.MouseEvent) => void, isActive?: boolean }) => (
    <button 
        className={`p-1.5 rounded transition-colors ${isActive ? 'bg-zinc-600 text-white shadow-inner' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
        onClick={onClick}
    >
        {icon}
    </button>
);

const ElementNode = ({ id, data, selected }: NodeProps<NodeData>) => {
  const { setNodes } = useReactFlow();
  const [editingField, setEditingField] = useState<'label' | 'content' | null>(null);
  const primaryColor = data.color || '#f97316';

  const handleChange = (field: string, value: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, [field]: value },
          };
        }
        return node;
      })
    );
  };

  return (
    <div
      className={`w-64 bg-zinc-800 border-2 rounded-md shadow-lg transition-all flex flex-col ${
        selected ? 'shadow-lg' : 'border-zinc-700 hover:border-zinc-600'
      }`}
      style={{ 
          borderColor: selected ? primaryColor : data.color || '#3f3f46',
          boxShadow: selected ? `0 0 10px ${primaryColor}33` : 'none'
      }}
    >
      {/* Header */}
      <div 
        className="p-2 rounded-t-sm flex items-center justify-between border-b"
        style={{ 
            backgroundColor: data.color ? `${data.color}11` : '#18181b',
            borderColor: data.color ? `${data.color}33` : '#3f3f46'
        }}
      >
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          <FileText size={16} style={{ color: primaryColor }} className="shrink-0" />
          
          <div className="flex-1 min-w-0" onDoubleClick={() => setEditingField('label')}>
            {editingField === 'label' ? (
                 <input 
                    className="nodrag w-full bg-transparent border-none outline-none p-0 text-sm font-semibold text-white placeholder-zinc-500"
                    value={data.label}
                    onChange={(e) => handleChange('label', e.target.value)}
                    autoFocus
                    onBlur={() => setEditingField(null)}
                    onKeyDown={(e) => {
                        if(e.key === 'Enter') setEditingField(null);
                    }}
                 />
            ) : (
                <div className="font-semibold text-sm text-zinc-200 truncate cursor-text" title="Double click to edit">
                    {data.label}
                </div>
            )}
          </div>
        </div>
        {data.assets && data.assets.length > 0 && <ImageIcon size={14} className="text-zinc-500 shrink-0" />}
      </div>

      {/* Body */}
      <div className="p-3 bg-zinc-800/50 flex-1 relative min-h-[6rem]">
        <div className="h-full w-full" onDoubleClick={(e) => { e.stopPropagation(); setEditingField('content'); }}>
            {editingField === 'content' ? (
                <RichTextEditor 
                    initialValue={data.content || ''}
                    onChange={(val) => handleChange('content', val)}
                    onBlur={() => setEditingField(null)}
                    variables={data.variables}
                />
            ) : (
                <div 
                    className="text-xs text-zinc-300 whitespace-pre-wrap cursor-text markdown-content"
                    dangerouslySetInnerHTML={{ __html: data.content || '<span class="italic opacity-30 select-none">Double click to add content...</span>' }}
                />
            )}
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-zinc-900 transition-colors"
        style={{ backgroundColor: '#a1a1aa' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-zinc-900 transition-colors"
        style={{ backgroundColor: primaryColor }}
      />
      
      <style>{`
        .markdown-content blockquote { 
            border-left: 3px solid #52525b; 
            padding-left: 8px; 
            font-style: italic; 
            color: #a1a1aa; 
            margin: 4px 0; 
        }
        .markdown-content pre { 
            background: #18181b; 
            padding: 8px; 
            border-radius: 4px; 
            font-family: 'JetBrains Mono', monospace; 
            border: 1px solid #27272a; 
            color: #a1a1aa; 
            margin: 6px 0; 
            white-space: pre-wrap; 
        }
        .markdown-content ul { 
            list-style-type: disc; 
            padding-left: 20px; 
            margin: 4px 0; 
        }
        /* Editor Highlight Colors */
        .markdown-content .text-blue-400 { color: #60a5fa; }
        .markdown-content .text-white { color: #ffffff; }
        .markdown-content .text-zinc-400 { color: #a1a1aa; }
        .markdown-content .text-purple-400 { color: #a78bfa; }
      `}</style>
    </div>
  );
};

export default memo(ElementNode);