import { FilePlus2, Upload, ArrowRight } from 'lucide-react';
import { ProjectThumbnail } from '../../models/story';
import { focusRing } from '../ui/styles';
import { GraphThumbnail } from './GraphThumbnail';

interface FirstRunProps {
  onExample: () => void;
  exampleBusy: boolean;
  onBlank: () => void;
  onImport: () => void;
}

// Illustrative branching shape for the example tile (the real example's graph
// appears on its card once added).
const SAMPLE: ProjectThumbnail = {
  aspect: 2.2,
  n: [
    [0, 0.5, 3], [0.18, 0.5, 0], [0.36, 0.2, 0], [0.36, 0.8, 1], [0.55, 0.05, 0], [0.55, 0.35, 0],
    [0.55, 0.65, 0], [0.55, 0.95, 2], [0.75, 0.2, 0], [0.75, 0.8, 0], [1, 0.35, 0], [1, 0.8, 0],
  ],
  e: [[0, 1], [1, 2], [1, 3], [2, 4], [2, 5], [3, 6], [3, 7], [4, 8], [5, 8], [6, 9], [8, 10], [9, 10], [9, 11]],
};

const tile = `group relative flex w-full flex-col rounded-lg border border-nt-line bg-nt-surface text-left transition-colors duration-150 hover:border-nt-line-strong hover:bg-nt-raised/40 ${focusRing}`;

export function FirstRun({ onExample, exampleBusy, onBlank, onImport }: FirstRunProps) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-2xl font-semibold tracking-tight text-nt-ink [text-wrap:balance]">Start your first story</h1>
      <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-nt-ink-2">
        NodeTale lays a branching story out as scenes and choices you can see, play and untangle. Pick a way in. You can always add more later.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-[1.5fr_1fr] md:grid-rows-2">
        <button type="button" onClick={onExample} disabled={exampleBusy} className={`${tile} md:row-span-2`}>
          <div className="pointer-events-none aspect-[2.2/1] w-full rounded-t-[7px] border-b border-nt-line bg-nt-bg bg-[radial-gradient(oklch(var(--nt-line))_1px,transparent_1px)] bg-[length:14px_14px] p-6">
            <GraphThumbnail thumbnail={SAMPLE} size="row" />
          </div>
          <div className="flex flex-1 flex-col p-5">
            <span className="text-base font-semibold text-nt-ink">Explore the example</span>
            <span className="mt-1 text-sm leading-relaxed text-nt-ink-2">
              A short mystery with choices, conditions, variables and media. Open it, play it, take it apart.
            </span>
            <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium text-nt-accent">
              {exampleBusy ? 'Adding the example…' : <>Add example story <ArrowRight size={15} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5" /></>}
            </span>
          </div>
        </button>

        <button type="button" onClick={onBlank} className={`${tile} p-5`}>
          <FilePlus2 size={20} aria-hidden className="text-nt-ink-2" />
          <span className="mt-3 text-sm font-semibold text-nt-ink">Blank story</span>
          <span className="mt-1 text-sm text-nt-ink-3">One Start scene on an empty board.</span>
        </button>

        <button type="button" onClick={onImport} className={`${tile} p-5`}>
          <Upload size={20} aria-hidden className="text-nt-ink-2" />
          <span className="mt-3 text-sm font-semibold text-nt-ink">Import a file</span>
          <span className="mt-1 text-sm text-nt-ink-3">A .json or .zip exported from NodeTale.</span>
        </button>
      </div>
    </section>
  );
}
