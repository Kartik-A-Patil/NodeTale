import React, { useMemo } from 'react';
import { AppNode } from '@/types';
import { Clock } from 'lucide-react';

interface TimelineViewProps {
  nodes: AppNode[];
  onNodeClick: (nodeId: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ nodes, onNodeClick }) => {

  const sortedNodes = useMemo(() => {
    // Only show elementNode types with dates
    const filtered = nodes.filter(n => n.type === 'elementNode' && n.data.date);
    
    // Sort by date
    return filtered.sort((a, b) => {
      return new Date(a.data.date!).getTime() - new Date(b.data.date!).getTime();
    });
  }, [nodes]);

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

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0f0f11] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
      <div className="max-w-5xl mx-auto py-12 px-6 min-h-full">
        {/* Timeline */}
        <div className="relative">
          {/* Vertical line with subtle animation */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-orange-500/30 via-zinc-700/40 to-orange-500/30 animate-[linePulse_6s_ease-in-out_infinite]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.45),transparent_45%)] animate-[lineShimmer_4s_linear_infinite]" />
          </div>
          
          {/* Events */}
          <div className="space-y-12">
            {sortedNodes.map((node, index) => {
              const isLeft = index % 2 === 0;
              const nodeColor = node.data.color || '#f97316'; // Default to orange-500

              return (
                <div 
                  key={node.id} 
                  onClick={() => onNodeClick(node.id)}
                  className={`relative flex items-center justify-between group cursor-pointer ${isLeft ? 'flex-row-reverse' : ''}`}
                >
                  {/* Empty space for opposite side */}
                  <div className="w-5/12" />

                  {/* Timeline dot */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#0f0f11] border-2 transition-all z-10 group-hover:scale-125 group-hover:bg-zinc-900"
                    style={{ 
                      borderColor: nodeColor,
                      boxShadow: `0 0 15px ${nodeColor}50`
                    }}
                  />
                  
                  {/* Content card */}
                  <div className={`w-5/12 ${isLeft ? 'text-right' : 'text-left'}`}>
                    <div 
                      className="bg-zinc-900/50 border rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-900"
                      style={{ 
                        borderColor: `${nodeColor}50`,
                        boxShadow: `0 4px 20px -12px ${nodeColor}40`
                      }}
                    >
                      <h3 
                        className="font-bold text-lg mb-1"
                        style={{ color: nodeColor }}
                      >
                        {node.data.label}
                      </h3>
                      
                      <div className={`flex items-center gap-1.5 text-xs text-zinc-500 mb-3 ${isLeft ? 'justify-end' : 'justify-start'}`}>
                        <Clock size={12} />
                        <span>{formatDate(node.data.date!)}</span>
                      </div>
                      
                      {node.data.content && (
                        <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed">
                          {stripHtml(node.data.content)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Empty state */}
          {sortedNodes.length === 0 && (
            <div className="text-center py-20">
              <p className="text-zinc-500">No timeline events yet</p>
              <p className="text-xs text-zinc-600 mt-1">Add dates to your element nodes</p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes linePulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.95; }
        }
        @keyframes lineShimmer {
          0% { background-position: 50% -120%; }
          100% { background-position: 50% 220%; }
        }
      `}</style>
    </div>
  );
};
