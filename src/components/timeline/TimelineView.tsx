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

  const hasEvents = sortedNodes.length > 0;

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
          {/* Vertical line */}
          {hasEvents && (
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-zinc-800" />
          )}
          
          {/* Events */}
          <div className="space-y-12">
            {sortedNodes.map((node, index) => {
              const isLeft = index % 2 === 0;
              const nodeColor = node.data.color || '#f97316'; // Default to orange-500
                  const mutedBorder = `${nodeColor}45`;
                  const mutedFill = `${nodeColor}12`;

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
                    className="absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#0f0f11] border-[1.5px] transition-colors z-10"
                    style={{ borderColor: mutedBorder, backgroundColor: mutedFill }}
                  />
                  
                  {/* Content card */}
                  <div className={`w-5/12 ${isLeft ? 'text-right' : 'text-left'}`}>
                    <div 
                      className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 transition-colors duration-200 hover:border-zinc-700"
                      style={{ boxShadow: '0 2px 12px -10px rgba(0,0,0,0.6)' }}
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
    </div>
  );
};
