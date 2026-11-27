import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BookOpen, Boxes, Braces, Clapperboard, CornerDownRight, GitFork, Info, LayoutTemplate, MessageSquare, Play, Split, Variable, X,
} from 'lucide-react';
import { SCRIPT_FUNCTIONS } from '../../core/runtime/scriptInterpreter';
import { KEYS } from '../../editor/shortcuts/keymap';
import { ShortcutKbd } from '../ui/kbd';
import { buttonGhostIcon } from '../ui/styles';
import { DiagramCode, HelpDiagram } from './HelpDiagram';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SectionId = 'start' | 'nodes' | 'paths' | 'variables' | 'logic' | 'play';

const SECTIONS: { id: SectionId; label: string; icon: typeof BookOpen }[] = [
  { id: 'start', label: 'Getting started', icon: BookOpen },
  { id: 'nodes', label: 'Nodes', icon: Boxes },
  { id: 'paths', label: 'Branches & jumps', icon: Split },
  { id: 'variables', label: 'Variables', icon: Variable },
  { id: 'logic', label: 'Logic blocks', icon: Braces },
  { id: 'play', label: 'Play mode', icon: Play },
];

// How NodeTale works, shown with pictures of the board itself. Shortcuts live
// in the command palette (Ctrl+K), which lists every command with its keys.
export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState<SectionId>('start');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={ref}
      aria-label="Help"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="nt-dialog h-[min(88vh,48rem)] w-[min(64rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-nt-line bg-nt-surface p-0 text-nt-ink shadow-2xl [&:not([open])]:hidden"
    >
      <div className="flex h-full">
        <nav aria-label="Help topics" className="flex w-56 shrink-0 flex-col border-r border-nt-line p-3">
          <h2 className="px-2 pb-3 pt-1 text-base font-semibold">Help</h2>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? 'page' : undefined}
              className="flex h-9 items-center gap-2.5 rounded-md px-2 text-left text-sm text-nt-ink-2 outline-none transition-colors hover:bg-nt-raised hover:text-nt-ink focus-visible:ring-2 focus-visible:ring-nt-focus aria-[current=page]:bg-nt-raised aria-[current=page]:text-nt-ink">
              <Icon size={15} className="shrink-0" /> {label}
            </button>
          ))}
          <p className="mt-auto flex flex-wrap items-center gap-1.5 px-2 text-xs leading-relaxed text-nt-ink-3">
            All commands and shortcuts: <ShortcutKbd keys={KEYS.palette} />
          </p>
        </nav>
        <div className="relative min-w-0 flex-1 overflow-y-auto px-8 py-7">
          <button type="button" onClick={onClose} className={`${buttonGhostIcon} absolute right-3 top-3`} aria-label="Close help"><X size={16} /></button>
          <div className="mx-auto max-w-2xl space-y-6">
            {section === 'start' && <GettingStarted />}
            {section === 'nodes' && <Nodes />}
            {section === 'paths' && <Paths />}
            {section === 'variables' && <Variables />}
            {section === 'logic' && <LogicBlocks />}
            {section === 'play' && <PlayMode />}
          </div>
        </div>
      </div>
    </dialog>
  );
}

const Title = ({ children, lead }: { children: ReactNode; lead: ReactNode }) => (
  <header>
    <h3 className="text-xl font-semibold text-nt-ink">{children}</h3>
    <p className="mt-1.5 text-sm leading-relaxed text-nt-ink-2">{lead}</p>
  </header>
);

const Heading = ({ children }: { children: ReactNode }) => <h4 className="pt-2 text-sm font-semibold text-nt-ink">{children}</h4>;
const Text = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-nt-ink-2">{children}</p>;
const Code = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-lg border border-nt-line bg-nt-bg px-4 py-3 font-mono text-xs leading-relaxed text-nt-ink-2 [font-variant-ligatures:none]">{children}</pre>
);
const Inline = ({ children }: { children: ReactNode }) => <code className="rounded bg-nt-bg px-1 py-0.5 font-mono text-[0.85em] text-nt-ink [font-variant-ligatures:none]">{children}</code>;

const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="space-y-2.5">
    {items.map((item, i) => (
      <li key={i} className="flex gap-3 text-sm leading-relaxed text-nt-ink-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nt-raised text-[11px] font-semibold text-nt-ink">{i + 1}</span>
        <span>{item}</span>
      </li>
    ))}
  </ol>
);

const GettingStarted = () => (
  <>
    <Title lead="A story is a board of scenes joined by choices. Every connection you draw is a choice the player can make.">Getting started</Title>
    <HelpDiagram
      width={470} height={170}
      description="A Start scene with two choices, Open the door and Walk away, leading to two different scenes."
      nodes={[
        { id: 'start', x: 0, y: 45, w: 150, h: 76, icon: Clapperboard, title: 'Start', body: 'Rain taps on the glass…' },
        { id: 'hall', x: 300, y: 0, w: 150, h: 64, icon: Clapperboard, title: 'Hallway', body: 'Dust in the lights.' },
        { id: 'away', x: 300, y: 106, w: 150, h: 64, icon: Clapperboard, title: 'Driving home', body: 'You never look back.' },
      ]}
      edges={[
        { from: 'start', to: 'hall', label: 'Open the door' },
        { from: 'start', to: 'away', label: 'Walk away' },
      ]}
    />
    <Steps items={[
      <>Add a scene from the dock, or press <ShortcutKbd keys={KEYS.addScene} />. Name your first one <strong className="text-nt-ink">Start</strong>; the story begins there.</>,
      <>Double-click a scene to write. Type <Inline>/</Inline> for headings, lists and logic blocks.</>,
      <>Drag from a scene’s edge to another scene to add a choice. The line’s label is the choice text.</>,
      <>Press <strong className="text-nt-ink">Play</strong> to read it as a player would.</>,
    ]} />
  </>
);

const NODE_TYPES = [
  { icon: Clapperboard, title: 'Scene', text: 'Story text, images and sound. Lines leaving a scene are the player’s choices.' },
  { icon: GitFork, title: 'Branch', text: 'Picks a path by itself, using conditions on your variables. The first true case wins.' },
  { icon: CornerDownRight, title: 'Jump', text: 'Continues the story at another scene, even on another board.' },
  { icon: MessageSquare, title: 'Comment', text: 'A note for you. Players never see it.' },
  { icon: LayoutTemplate, title: 'Section', text: 'A labelled frame to group part of the board.' },
  { icon: Info, title: 'Annotation', text: 'A floating label with an arrow, to explain the board.' },
];

const Nodes = () => (
  <>
    <Title lead="Six kinds of node. Only scenes, branches and jumps take part in the story; the rest organise the board.">Nodes</Title>
    <div className="grid gap-3 sm:grid-cols-2">
      {NODE_TYPES.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex gap-3 rounded-xl border border-nt-line p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nt-raised text-nt-ink-2"><Icon size={16} /></span>
          <div>
            <div className="text-sm font-semibold text-nt-ink">{title}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-nt-ink-3">{text}</p>
          </div>
        </div>
      ))}
    </div>
    <Text>Badges on nodes point out Start, endings, dead ends (a path that goes nowhere) and scenes no path reaches.</Text>
  </>
);

const Paths = () => (
  <>
    <Title lead="Choices let the player decide. Branches and jumps decide for them, based on what has happened so far.">Branches & jumps</Title>
    <Heading>A branch checks your variables</Heading>
    <HelpDiagram
      width={500} height={160}
      description="A Vault scene adds 10 gold, then a branch checks gold of at least 10: if true the story goes to Buy the key, otherwise to Leave."
      nodes={[
        { id: 'vault', x: 0, y: 40, w: 140, h: 80, icon: Clapperboard, title: 'Vault', body: <>You find coins.<DiagramCode>gold += 10</DiagramCode></> },
        { id: 'branch', x: 180, y: 44, w: 150, h: 72, body: <div className="-mx-2.5 -my-1.5 font-mono"><div className="flex h-9 items-center border-b border-nt-line/60 px-2.5"><b className="mr-2 text-nt-ink">if</b> gold &gt;= 10</div><div className="flex h-9 items-center px-2.5"><b className="mr-2 text-nt-ink">else</b></div></div> },
        { id: 'buy', x: 370, y: 12, w: 130, h: 30, icon: Clapperboard, title: 'Buy the key' },
        { id: 'leave', x: 370, y: 118, w: 130, h: 30, icon: Clapperboard, title: 'Leave' },
      ]}
      edges={[
        { from: 'vault', to: 'branch' },
        { from: 'branch', to: 'buy', fromY: 18 },
        { from: 'branch', to: 'leave', fromY: 54 },
      ]}
    />
    <Text>Each case is checked from the top; the first that is true is followed. <Inline>else</Inline> catches everything else. Right-click a branch to add a case.</Text>
    <Heading>A jump continues somewhere else</Heading>
    <HelpDiagram
      width={500} height={96}
      description="A scene leads into a jump, which continues at the Cellar scene on the Chapter 2 board."
      nodes={[
        { id: 'end', x: 0, y: 14, w: 140, h: 64, icon: Clapperboard, title: 'Trapdoor', body: 'It creaks open.' },
        { id: 'jump', x: 180, y: 26, w: 130, h: 40, body: <span className="flex items-center gap-1.5 text-nt-ink"><CornerDownRight size={12} className="text-nt-ink-3" /> Jump to Cellar</span> },
        { id: 'cellar', x: 360, y: 14, w: 140, h: 64, icon: Clapperboard, title: 'Cellar', body: <span className="text-nt-ink-3">Board: Chapter 2</span> },
      ]}
      edges={[{ from: 'end', to: 'jump' }, { from: 'jump', to: 'cellar', dashed: true }]}
    />
    <Text>Use jumps to reach scenes on other boards or far across the board, without long crossing lines.</Text>
  </>
);

const VARIABLE_TYPES = [
  ['Text', 'name = "Alex"'],
  ['Number', 'gold = 10'],
  ['True / false', 'hasKey = true'],
  ['List', 'inventory = arrayPush(inventory, "rope")'],
  ['Object', 'player = objectSpread(player, { hp: 50 })'],
];

const Variables = () => (
  <>
    <Title lead="Variables remember what happened: gold found, doors opened, names chosen. Add them in the Variables panel.">Variables</Title>
    <div className="overflow-hidden rounded-xl border border-nt-line">
      {VARIABLE_TYPES.map(([type, example]) => (
        <div key={type} className="flex items-center gap-4 border-b border-nt-line px-4 py-2.5 last:border-0">
          <span className="w-28 shrink-0 text-sm text-nt-ink">{type}</span>
          <code className="truncate font-mono text-xs text-nt-ink-2 [font-variant-ligatures:none]">{example}</code>
        </div>
      ))}
    </div>
    <Heading>Show a value in the story</Heading>
    <Text>Wrap its name in double braces. In a scene, type <Inline>{'{{'}</Inline> to pick one from a list.</Text>
    <Code>{'You have {{gold}} coins, {{name}}.'}</Code>
    <Heading>Use it in a branch</Heading>
    <Text>Conditions compare values with <Inline>==</Inline> <Inline>!=</Inline> <Inline>&gt;</Inline> <Inline>&lt;</Inline> <Inline>&gt;=</Inline> <Inline>&lt;=</Inline> and combine them with <Inline>&&</Inline> (and), <Inline>||</Inline> (or) and <Inline>!</Inline> (not).</Text>
    <Code>{'gold >= 10 && !hasKey'}</Code>
  </>
);

const LogicBlocks = () => (
  <>
    <Title lead="A logic block changes variables when the player reaches its scene. Type / in a scene and choose Logic block.">Logic blocks</Title>
    <Code>{'gold += 10\nhasKey = true\nname = "Alex"\ninventory = arrayPush(inventory, "rope")'}</Code>
    <Text>One change per line: <Inline>=</Inline> sets a value, <Inline>+=</Inline> <Inline>-=</Inline> <Inline>*=</Inline> <Inline>/=</Inline> update it. Only variables from the Variables panel can be changed.</Text>
    <Text>While you type, suggestions show your variables and the functions below; <Inline>Tab</Inline> or <Inline>Enter</Inline> accepts one. A red Error badge on the scene means a line needs fixing.</Text>
    <Heading>Functions for lists and objects</Heading>
    <div className="overflow-hidden rounded-xl border border-nt-line">
      {SCRIPT_FUNCTIONS.map((fn) => (
        <div key={fn.name} className="flex flex-col gap-0.5 border-b border-nt-line px-4 py-2.5 last:border-0 sm:flex-row sm:items-center sm:gap-4">
          <code className="shrink-0 font-mono text-xs text-nt-ink [font-variant-ligatures:none] sm:w-72">{fn.signature}</code>
          <span className="text-xs text-nt-ink-3">{fn.description}</span>
        </div>
      ))}
    </div>
    <Text>These return a new value; assign it back to keep it, e.g. <Inline>{'coins = arrayFilter(coins, (c) => c > 1)'}</Inline>.</Text>
  </>
);

const PlayMode = () => (
  <>
    <Title lead="Play reads the story as a player would, from Start, running logic blocks and following branches as it goes.">Play mode</Title>
    <HelpDiagram
      width={470} height={170}
      description="Play follows one path at a time: from Start through Hallway to the ending, while the other path stays unplayed."
      nodes={[
        { id: 'start', x: 0, y: 45, w: 150, h: 76, icon: Clapperboard, title: 'Start', body: 'Rain taps on the glass…' },
        { id: 'hall', x: 300, y: 0, w: 150, h: 64, icon: Clapperboard, title: 'Hallway', body: 'Dust in the lights.' },
        { id: 'away', x: 300, y: 106, w: 150, h: 64, icon: Clapperboard, title: 'Driving home', muted: true },
      ]}
      edges={[
        { from: 'start', to: 'hall', label: 'Open the door', active: true },
        { from: 'start', to: 'away', label: 'Walk away' },
      ]}
    />
    <Steps items={[
      <>Press <strong className="text-nt-ink">Play</strong> to start from the scene named Start.</>,
      <>Right-click any scene and choose <strong className="text-nt-ink">Play from here</strong>, or select it and press <ShortcutKbd keys={KEYS.playFromHere} />.</>,
      'The variables panel in play mode shows every value as it changes.',
      'Branches and jumps are followed automatically; only choices wait for the player.',
    ]} />
  </>
);
