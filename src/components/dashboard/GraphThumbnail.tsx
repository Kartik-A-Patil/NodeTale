import { memo } from 'react';
import { ProjectThumbnail } from '../../models/story';

interface GraphThumbnailProps {
  thumbnail?: ProjectThumbnail;
  /** Pixel density of the drawing; smaller for list rows. */
  size?: 'card' | 'row';
}

const PAD = 10;

// A project's actual node graph, drawn from the positions stored in its
// summary. Recognizing a story by its shape beats reading a filename.
export const GraphThumbnail = memo(({ thumbnail, size = 'card' }: GraphThumbnailProps) => {
  if (!thumbnail || thumbnail.n.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-nt-ink-3">
        {size === 'card' ? 'Empty board' : null}
      </div>
    );
  }

  // Draw into a 160-high box whose width follows the board's aspect ratio;
  // the SVG then letterboxes itself into the card.
  const h = 160;
  const w = Math.round(h * thumbnail.aspect);
  const count = thumbnail.n.length;
  const r = size === 'row' ? Math.max(4, Math.min(9, 60 / Math.sqrt(count))) : Math.max(2.2, Math.min(6, 40 / Math.sqrt(count)));
  const px = (x: number) => PAD + x * (w - PAD * 2);
  const py = (y: number) => PAD + y * (h - PAD * 2);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden>
      <g stroke="oklch(var(--nt-ink-3) / 0.55)" strokeWidth={Math.max(0.8, r / 3.5)} fill="none">
        {thumbnail.e.map(([a, b], i) => {
          const [ax, ay] = thumbnail.n[a];
          const [bx, by] = thumbnail.n[b];
          const x1 = px(ax), y1 = py(ay), x2 = px(bx), y2 = py(by);
          const mx = (x1 + x2) / 2;
          return <path key={i} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} />;
        })}
      </g>
      {thumbnail.n.map(([x, y, kind], i) => {
        const cx = px(x), cy = py(y);
        if (kind === 3) return <circle key={i} cx={cx} cy={cy} r={r * 1.35} fill="oklch(var(--nt-accent))" />;
        if (kind === 1) return <path key={i} d={`M${cx} ${cy - r * 1.1} L${cx + r * 1.1} ${cy} L${cx} ${cy + r * 1.1} L${cx - r * 1.1} ${cy} Z`} fill="oklch(var(--nt-branch-0))" />;
        if (kind === 2) return <path key={i} d={`M${cx - r} ${cy - r} L${cx + r * 1.1} ${cy} L${cx - r} ${cy + r} Z`} fill="oklch(var(--nt-branch-3))" />;
        return <rect key={i} x={cx - r * 1.2} y={cy - r * 0.8} width={r * 2.4} height={r * 1.6} rx={r * 0.4} fill="oklch(var(--nt-ink-2))" />;
      })}
    </svg>
  );
});
