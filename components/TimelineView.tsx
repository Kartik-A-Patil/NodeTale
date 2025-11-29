import React, { useMemo, useState } from 'react';
import { AppNode } from '../types';
import { Calendar, Clock, Circle, FileText, GitFork, ArrowRightCircle, MessageSquare, AlignLeft, GitCommitVertical } from 'lucide-react';

interface TimelineViewProps {
  nodes: AppNode[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({ nodes }) => {
  const [mode, setMode] = useState<'linear' | 'alternating'>('alternating');

  const sortedNodes = useMemo(() => {
    // Separate nodes with and without dates
    const withDate = nodes.filter(n => n.data.date);
    const withoutDate = nodes.filter(n => !n.data.date);

    // Sort nodes with dates
    withDate.sort((a, b) => {
      return new Date(a.data.date!).getTime() - new Date(b.data.date!).getTime();
    });

    return { withDate, withoutDate };
  }, [nodes]);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'elementNode': return <FileText size={16} className="text-orange-500" />;
      case 'conditionNode': return <GitFork size={16} className="text-blue-500" />;
      case 'jumpNode': return <ArrowRightCircle size={16} className="text-purple-500" />;
      case 'commentNode': return <MessageSquare size={16} className="text-yellow-400" />;
      default: return <Circle size={16} className="text-zinc-500" />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(date);
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#0f0f11] p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-12">
            <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
                <Calendar className="text-orange-500" /> Timeline
            </h2>
            
            <div className="flex bg-zinc-800 rounded-lg p-1 border border-zinc-700">
                <button 
                    onClick={() => setMode('linear')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'linear' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                    <AlignLeft size={14} /> Linear
                </button>
                <button 
                    onClick={() => setMode('alternating')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'alternating' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                    <GitCommitVertical size={14} /> Story
                </button>
            </div>
        </div>

        {mode === 'linear' ? (
            <div className="relative max-w-3xl mx-auto">
                {/* Vertical Line */}
                <div className="absolute left-8 top-0 bottom-0 w-px bg-zinc-800" />

                {/* Dated Nodes */}
                <div className="space-y-8">
                    {sortedNodes.withDate.map((node, index) => (
                    <div key={node.id} className="relative flex gap-6 group">
                        {/* Time Marker */}
                        <div className="absolute left-8 -translate-x-1/2 w-4 h-4 rounded-full bg-[#0f0f11] border-2 border-zinc-700 group-hover:border-orange-500 transition-colors z-10 mt-1.5" />
                        
                        <div className="pl-16 flex-1">
                        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 hover:border-zinc-600 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                {getNodeIcon(node.type || 'elementNode')}
                                <span className="font-semibold text-zinc-200">{node.data.label}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                                <Clock size={12} />
                                {formatDate(node.data.date!)}
                            </div>
                            </div>
                            
                            {node.data.content && (
                            <div 
                                className="text-sm text-zinc-400 prose prose-invert max-w-none line-clamp-3"
                                dangerouslySetInnerHTML={{ __html: node.data.content }}
                            />
                            )}
                            
                            {node.type === 'conditionNode' && (
                                <div className="mt-2 text-xs text-blue-400 font-mono bg-blue-950/30 px-2 py-1 rounded inline-block">
                                    if {node.data.condition}
                                </div>
                            )}
                        </div>
                        </div>
                    </div>
                    ))}
                </div>
            </div>
        ) : (
            <div className="relative py-8">
                 {/* Center Line */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-zinc-800" />

                <div className="space-y-12">
                    {sortedNodes.withDate.map((node, index) => {
                        const isLeft = index % 2 === 0;
                        return (
                            <div key={node.id} className={`relative flex items-center w-full ${isLeft ? 'flex-row-reverse' : ''}`}>
                                {/* Content Side */}
                                <div className="w-1/2 px-12">
                                    <div className={`bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 hover:border-orange-500/50 transition-all hover:shadow-lg hover:shadow-orange-900/10 group ${isLeft ? 'text-right' : 'text-left'}`}>
                                        {/* Header */}
                                        <div className={`flex items-center gap-3 mb-4 ${isLeft ? 'justify-end' : ''}`}>
                                            {getNodeIcon(node.type || 'elementNode')}
                                            <span className="font-bold text-zinc-100 text-xl">{node.data.label}</span>
                                        </div>
                                        
                                        {/* Content */}
                                        {node.data.content && (
                                            <div 
                                                className="text-sm text-zinc-400 prose prose-invert max-w-none"
                                                dangerouslySetInnerHTML={{ __html: node.data.content }}
                                            />
                                        )}

                                         {node.type === 'conditionNode' && (
                                            <div className={`mt-4 text-xs text-blue-400 font-mono bg-blue-950/30 px-2 py-1 rounded inline-block`}>
                                                if {node.data.condition}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Center Marker */}
                                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center z-10">
                                    <div className="w-4 h-4 rounded-full bg-[#0f0f11] border-2 border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]" />
                                </div>
                                
                                {/* Date Side */}
                                <div className="w-1/2 px-12">
                                     <div className={`text-zinc-500 font-mono text-sm flex items-center gap-2 ${isLeft ? 'justify-start' : 'justify-end'}`}>
                                        {!isLeft && <Clock size={14} />}
                                        {formatDate(node.data.date!)}
                                        {isLeft && <Clock size={14} />}
                                     </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* Undated Section */}
        {sortedNodes.withoutDate.length > 0 && (
            <div className="mt-20 pt-8 border-t border-zinc-800 max-w-3xl mx-auto">
              <h3 className="text-lg font-semibold text-zinc-400 mb-6 text-center">Unscheduled</h3>
              <div className="space-y-4">
                {sortedNodes.withoutDate.map((node) => (
                  <div key={node.id} className="relative flex gap-6 group opacity-70 hover:opacity-100 transition-opacity">
                    <div className="flex-1">
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
                        {getNodeIcon(node.type || 'elementNode')}
                        <span className="text-zinc-300">{node.data.label}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

      </div>
      <style>{`
        .prose blockquote { 
            border-left: 3px solid #52525b; 
            padding-left: 8px; 
            font-style: italic; 
            color: #a1a1aa; 
            margin: 4px 0; 
        }
        .prose pre { 
            background: #18181b; 
            padding: 8px; 
            border-radius: 4px; 
            font-family: 'JetBrains Mono', monospace; 
            border: 1px solid #27272a; 
            color: #a1a1aa; 
            margin: 6px 0; 
            white-space: pre-wrap; 
        }
        .prose ul { 
            list-style-type: disc; 
            padding-left: 20px; 
            margin: 4px 0; 
        }
        /* Editor Highlight Colors */
        .prose .text-blue-400 { color: #60a5fa; }
        .prose .text-white { color: #ffffff; }
        .prose .text-zinc-400 { color: #a1a1aa; }
        .prose .text-purple-400 { color: #a78bfa; }
      `}</style>
    </div>
  );
};
