import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { buttonPrimary } from './ui/styles';

// A story path that draws itself and runs out: the last branch ends at a
// dashed "?" scene. Under reduced motion it's simply drawn.
function LostPath() {
  return (
    <svg viewBox="0 0 320 140" className="nt-lost w-full max-w-sm" aria-hidden>
      <g fill="none" strokeWidth="2" strokeLinecap="round">
        <path className="nt-lost-line" style={{ animationDelay: '0.2s' }} d="M64 70 C 100 70, 110 34, 146 34" stroke="oklch(var(--nt-line-strong))" />
        <path className="nt-lost-line" style={{ animationDelay: '0.45s' }} d="M64 70 C 100 70, 110 106, 146 106" stroke="oklch(var(--nt-line-strong))" />
        <path className="nt-lost-line" style={{ animationDelay: '0.9s' }} d="M194 106 C 222 106, 228 70, 254 70" stroke="oklch(var(--nt-accent))" strokeDasharray="5 6" />
      </g>
      <g className="nt-lost-node" style={{ animationDelay: '0s' }}>
        <rect x="16" y="52" width="48" height="36" rx="8" fill="oklch(var(--nt-surface))" stroke="oklch(var(--nt-line-strong))" strokeWidth="1.5" />
        <path d="M30 66h20M30 74h14" stroke="oklch(var(--nt-ink-3))" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="nt-lost-node" style={{ animationDelay: '0.55s' }}>
        <rect x="146" y="16" width="48" height="36" rx="8" fill="oklch(var(--nt-surface))" stroke="oklch(var(--nt-line-strong))" strokeWidth="1.5" />
        <path d="M160 30h20M160 38h12" stroke="oklch(var(--nt-ink-3))" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="nt-lost-node" style={{ animationDelay: '0.7s' }}>
        <rect x="146" y="88" width="48" height="36" rx="8" fill="oklch(var(--nt-surface))" stroke="oklch(var(--nt-line-strong))" strokeWidth="1.5" />
        <path d="M160 102h20M160 110h12" stroke="oklch(var(--nt-ink-3))" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="nt-lost-node nt-lost-end" style={{ animationDelay: '1.35s' }}>
        <rect x="254" y="50" width="48" height="40" rx="8" fill="none" stroke="oklch(var(--nt-accent))" strokeWidth="1.5" strokeDasharray="5 5" />
        <text x="278" y="77" textAnchor="middle" fontSize="20" fontWeight="600" fill="oklch(var(--nt-accent))">?</text>
      </g>
    </svg>
  );
}

/** For a story id that isn't here, and for any address that isn't a page. */
export default function NotFound({ what = 'page' }: { what?: 'story' | 'page' }) {
  const navigate = useNavigate();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-nt-bg px-4 text-center text-nt-ink">
      <LostPath />
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold [text-wrap:balance]">{what === 'story' ? 'This story isn’t here' : 'This path leads nowhere'}</h1>
        <p className="mt-2 text-sm leading-relaxed text-nt-ink-2">
          {what === 'story'
            ? 'The link may be mistyped, or the story was deleted from this browser. Stories live on the device they were made on.'
            : 'There’s no page at this address.'}
        </p>
      </div>
      <button type="button" className={buttonPrimary} onClick={() => navigate('/', { replace: true })}>
        <Home size={15} aria-hidden /> Go to my stories
      </button>
    </main>
  );
}
