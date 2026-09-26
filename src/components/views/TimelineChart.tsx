import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleTime } from 'd3-scale';
import { ZoomTransform, zoomIdentity } from 'd3-zoom';
import { StoryGraph } from '../../core/graph/storyGraph';
import {
  EmptyView, FocusNode, itemProps, LegendItem, LaneTag, NodeTooltip, Tooltip, ViewFrame,
  branchColor, branchMark, branchName, truncate, useTooltip, useZoomPan,
} from './shared';

const LANE_LABEL_W = 200;
const AXIS_H = 36;
const ROW_H = 30;
const LANE_PAD = 12;
const RIGHT_PAD = 180; // room for the last event label

interface TimelineEvent {
  id: string;
  time: Date;
  lane: LaneTag;
  label: string;
}

const laneKey = (tag: LaneTag) => String(tag);

export default function TimelineChart({ graph, onFocusNode }: { graph: StoryGraph; onFocusNode: FocusNode }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const noContent = useRef<SVGGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  // x-only: the zoom transform rescales the time axis; lanes stay put.
  const { fit, zoomBy } = useZoomPan(svgRef, noContent, { onZoom: setTransform, scaleExtent: [0.5, 5000] });
  const { tooltip, show, hide } = useTooltip(frameRef);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { events, undated } = useMemo(() => {
    const events: TimelineEvent[] = [];
    let undated = 0;
    for (const node of graph.nodes.values()) {
      if (node.type !== 'elementNode') continue;
      const time = node.date ? new Date(node.date) : null;
      if (!time || Number.isNaN(time.getTime())) {
        undated++;
        continue;
      }
      const lane: LaneTag = graph.reachable.has(node.id) ? graph.branchOf.get(node.id) ?? 'trunk' : 'unreachable';
      events.push({ id: node.id, time, lane, label: node.label });
    }
    return { events: events.sort((a, b) => +a.time - +b.time), undated };
  }, [graph]);

  const lanes = useMemo(() => {
    const present = new Set(events.map((e) => laneKey(e.lane)));
    const order: LaneTag[] = ['trunk', ...graph.branchRoots.map((_, i) => i), 'shared', 'unreachable'];
    return order.filter((tag) => present.has(laneKey(tag)));
  }, [events, graph]);

  const baseScale = useMemo(() => {
    if (!events.length || !width) return null;
    const first = +events[0].time;
    const last = +events[events.length - 1].time;
    const pad = Math.max((last - first) * 0.06, 30 * 60 * 1000);
    return scaleTime().domain([new Date(first - pad), new Date(last + pad)]).range([LANE_LABEL_W + 16, width - RIGHT_PAD]);
  }, [events, width]);

  const x = useMemo(() => (baseScale ? transform.rescaleX(baseScale) : null), [baseScale, transform]);

  // Stack events whose labels would collide, per lane, at the current zoom.
  const layout = useMemo(() => {
    if (!x) return null;
    let y = AXIS_H;
    const placed: { event: TimelineEvent; px: number; y: number }[] = [];
    const laneBands: { tag: LaneTag; y: number; h: number }[] = [];
    for (const tag of lanes) {
      const rowEnds: number[] = [];
      const laneEvents = events.filter((e) => laneKey(e.lane) === laneKey(tag));
      const laneTop = y;
      for (const event of laneEvents) {
        const px = x(event.time);
        const labelW = Math.min(170, truncate(event.label, 24).length * 6.6 + 30);
        let row = rowEnds.findIndex((end) => end < px - 6);
        if (row === -1) row = rowEnds.length;
        rowEnds[row] = px + labelW;
        placed.push({ event, px, y: laneTop + LANE_PAD + row * ROW_H + ROW_H / 2 });
      }
      const h = LANE_PAD * 2 + Math.max(1, rowEnds.length) * ROW_H;
      laneBands.push({ tag, y: laneTop, h });
      y += h;
    }
    return { placed, laneBands, height: y };
  }, [x, lanes, events]);

  const legend = (
    <>
      <LegendItem swatch={<circle cx="7" cy="7" r="5.5" fill="oklch(var(--nt-ink-3))" />}>• before the first choice</LegendItem>
      <LegendItem swatch={<circle cx="7" cy="7" r="5.5" fill="oklch(var(--nt-ink-2))" />}>∗ shared</LegendItem>
      <span className="text-nt-ink-3">Scroll to zoom time, drag to pan</span>
    </>
  );

  const summary = `${events.length} dated ${events.length === 1 ? 'scene' : 'scenes'}${undated ? ` · ${undated} without a date` : ''}`;

  if (!events.length) {
    return (
      <ViewFrame title="Timeline" frameRef={frameRef}>
        <EmptyView title="No dated scenes yet">
          Give scenes a date with the calendar button on a scene in Flow view. They’ll appear here on a real time axis, one lane per branch, so you can check that the chronology holds up on every path.
        </EmptyView>
      </ViewFrame>
    );
  }

  const ticks = x ? x.ticks(Math.max(2, Math.floor((width - LANE_LABEL_W) / 120))) : [];
  const tickFormat = x ? x.tickFormat() : () => '';

  return (
    <ViewFrame title="Timeline" summary={summary} legend={legend} onFit={() => fit()} onZoom={zoomBy} frameRef={frameRef}>
      <div className="h-full overflow-y-auto">
        <svg ref={svgRef} width={width} height={Math.max(layout?.height ?? 0, 200)} className="block cursor-grab active:cursor-grabbing" role="group" aria-label="Timeline of dated scenes">
          <g ref={noContent} />
          {layout && x && (
            <>
              {layout.laneBands.map((band, i) => (
                <g key={laneKey(band.tag)}>
                  <rect x={0} y={band.y} width={width} height={band.h} fill={i % 2 ? 'oklch(var(--nt-surface) / 0.45)' : 'transparent'} />
                  <line x1={0} x2={width} y1={band.y + band.h} y2={band.y + band.h} stroke="oklch(var(--nt-line))" />
                  <g transform={`translate(20,${band.y + LANE_PAD + ROW_H / 2})`}>
                    <circle r={8} fill={branchColor(band.tag)} />
                    <text y={3.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="oklch(var(--nt-bg))">{branchMark(band.tag)}</text>
                    <text x={16} y={4} fontSize="12" fill="oklch(var(--nt-ink-2))">{truncate(branchName(band.tag, graph.branchRoots), 24)}</text>
                  </g>
                </g>
              ))}
              <rect x={LANE_LABEL_W} y={0} width={1} height={layout.height} fill="oklch(var(--nt-line))" />
              {ticks.map((t) => (
                <g key={+t} transform={`translate(${x(t)},0)`}>
                  {x(t) > LANE_LABEL_W && (
                    <>
                      <line y1={AXIS_H - 6} y2={layout.height} stroke="oklch(var(--nt-line) / 0.7)" strokeDasharray="2 4" />
                      <text y={AXIS_H - 12} textAnchor="middle" fontSize="11" className="font-mono" fill="oklch(var(--nt-ink-3))">{tickFormat(t)}</text>
                    </>
                  )}
                </g>
              ))}
              <line x1={LANE_LABEL_W} x2={width} y1={AXIS_H - 6} y2={AXIS_H - 6} stroke="oklch(var(--nt-line-strong))" />
              {layout.placed.map(({ event, px, y }) =>
                px < LANE_LABEL_W - 4 ? null : (
                  <g key={event.id} transform={`translate(${px},${y})`}
                    {...itemProps(`${event.label}, ${event.time.toLocaleString()}, ${branchName(event.lane, graph.branchRoots)}. Open on canvas`, () => onFocusNode(event.id))}
                    onMouseMove={(e) => show(e, <NodeTooltip node={graph.nodes.get(event.id)!} extra={branchName(event.lane, graph.branchRoots)} />)}
                    onMouseLeave={hide}>
                    <rect className="nt-focus-ring" x={-12} y={-12} width={Math.min(170, truncate(event.label, 24).length * 6.6 + 30) + 4} height={24} rx={12} fill="none" stroke="oklch(var(--nt-focus))" strokeWidth={2} />
                    <rect x={-10} y={-10} width={Math.min(170, truncate(event.label, 24).length * 6.6 + 30)} height={20} rx={10} fill="oklch(var(--nt-raised))" stroke="oklch(var(--nt-line))" />
                    <circle r={7} fill={branchColor(event.lane)} />
                    <text y={3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="oklch(var(--nt-bg))">{branchMark(event.lane)}</text>
                    <text x={12} y={4} fontSize="11.5" fill="oklch(var(--nt-ink))">{truncate(event.label, 24)}</text>
                  </g>
                )
              )}
            </>
          )}
        </svg>
      </div>
      <Tooltip tooltip={tooltip} />
    </ViewFrame>
  );
}
