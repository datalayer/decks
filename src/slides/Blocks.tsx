/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { JSX, ReactElement } from 'react';
import { Code, Fragment } from '@revealjs/react';
import { deckComponent } from '../registry/components';
import { inline, paragraphs } from '../inline';
import type { BlockSpec, BulletIcon, ColumnSpec, MetricSpec } from '../types';

const MARKS: Record<Exclude<BulletIcon, 'none'>, string> = {
  dot: '●',
  check: '✓',
  arrow: '→',
};

/**
 * Reveal one element at a time, or all at once.
 *
 * A spec asks for stepping with `fragments: true` on the slide; which elements
 * step is the slide type's decision, not the spec's, which is why this is a
 * helper here rather than a field in the schema.
 */
export const stepped = (
  element: ReactElement,
  fragments: boolean | undefined,
  key: string,
): ReactElement =>
  fragments ? (
    <Fragment key={key} animation="fade-up" asChild>
      {element}
    </Fragment>
  ) : (
    element
  );

type BulletsProps = { items: string[]; icon?: BulletIcon; fragments?: boolean };

export const Bullets = ({
  items,
  icon = 'dot',
  fragments,
}: BulletsProps): JSX.Element => (
  // A list with no marks is a plain list of lines — a set of names, say —
  // and reads as one at a tighter pitch than points with marks in front.
  <ul className={icon === 'none' ? 'dla-bullets dla-bullets--plain' : 'dla-bullets'}>
    {items.map((item, position) => {
      const key = `${position}-${item.slice(0, 24)}`;
      return stepped(
        <li key={key}>
          {icon !== 'none' && (
            <span className={`dla-bullet-mark dla-bullet-mark--${icon}`} aria-hidden>
              {MARKS[icon]}
            </span>
          )}
          <span>{inline(item)}</span>
        </li>,
        fragments,
        key,
      );
    })}
  </ul>
);

type MetricsProps = { metrics: MetricSpec[]; fragments?: boolean };

export const Metrics = ({ metrics, fragments }: MetricsProps): JSX.Element => (
  <div
    className="dla-metrics"
    // Four across is the most that stays readable at 1280 wide; past that the
    // grid wraps rather than shrinking the numbers into illegibility.
    style={{ '--dla-metrics-columns': Math.min(metrics.length, 4) } as never}
  >
    {metrics.map((metric, position) => {
      const key = `${position}-${metric.label}`;
      return stepped(
        <div className="dla-metric" key={key}>
          <div className="dla-metric-value">{metric.value}</div>
          <div className="dla-metric-label">{inline(metric.label)}</div>
          {metric.detail && (
            <div className="dla-metric-detail">{inline(metric.detail)}</div>
          )}
        </div>,
        fragments,
        key,
      );
    })}
  </div>
);

type CodeBlockProps = {
  code: string;
  language?: string;
  lineNumbers?: boolean | string;
  caption?: string;
};

export const CodeBlock = ({
  code,
  language = 'python',
  lineNumbers,
  caption,
}: CodeBlockProps): JSX.Element => (
  <div className="dla-code">
    <Code language={language} lineNumbers={lineNumbers} trim>
      {code}
    </Code>
    {caption && <div className="dla-code-caption">{inline(caption)}</div>}
  </div>
);

type MermaidDiagramProps = { diagram: string; caption?: string };
let mermaidRenderSequence = 0;

/**
 * Compile Mermaid source after the slide reaches the browser.
 *
 * Mermaid is loaded lazily: deck rendering remains safe in server-side and
 * build-time contexts, while the generated SVG still becomes ordinary slide
 * markup that Reveal can scale and print. `strict` is important here because
 * diagram source may have arrived from a YAML file or an agent.
 */
export const MermaidDiagram = ({ diagram, caption }: MermaidDiagramProps): JSX.Element => {
  const target = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    const element = target.current;
    if (!element) {
      return undefined;
    }

    element.replaceChildren();
    setError(undefined);
    const render = async (): Promise<void> => {
      const { default: mermaid } = await import('mermaid');
      const styles = getComputedStyle(element);
      const token = (name: string, fallback: string): string =>
        styles.getPropertyValue(name).trim() || fallback;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        fontFamily: token('--dla-deck-font', 'system-ui, sans-serif'),
        themeVariables: {
          background: token('--dla-deck-background', '#ffffff'),
          primaryColor: token('--dla-deck-surface', '#f6f8fa'),
          primaryTextColor: token('--dla-deck-foreground', '#1f2328'),
          primaryBorderColor: token('--dla-deck-border', '#d0d7de'),
          lineColor: token('--dla-deck-muted', '#59636e'),
          secondaryColor: token('--dla-deck-accent-soft', '#ddf4ff'),
          tertiaryColor: token('--dla-deck-background', '#ffffff'),
        },
      });
      // StrictMode may start the effect twice before the first render settles;
      // Mermaid uses this id for temporary DOM, so every attempt needs its own.
      const id =
        `dla-mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}-` +
        `${++mermaidRenderSequence}`;
      const result = await mermaid.render(id, diagram);
      if (!active || !target.current) {
        return;
      }
      target.current.innerHTML = result.svg;
      result.bindFunctions?.(target.current);
    };

    void render().catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    });
    return () => {
      active = false;
      element.replaceChildren();
    };
  }, [diagram, reactId]);

  return (
    <figure className="dla-mermaid">
      <div
        ref={target}
        className={`dla-mermaid-svg${error ? ' dla-mermaid-svg--hidden' : ''}`}
        role="img"
        aria-label="Diagram"
      />
      {error && (
        <div className="dla-slide-error">Mermaid could not render this diagram: {error}</div>
      )}
      {caption && <figcaption>{inline(caption)}</figcaption>}
    </figure>
  );
};

/**
 * A component named by a spec, or a visible complaint that it does not exist.
 *
 * The complaint is on the slide rather than in the console because a deck is
 * usually being fixed minutes before it is presented, and a blank column is
 * not a symptom anyone reads as "that name is not in the registry".
 */
const NamedComponent = ({
  name,
  props,
}: {
  name: string;
  props?: Record<string, unknown>;
}): JSX.Element => {
  const Component = deckComponent(name);
  if (!Component) {
    return (
      <div className="dla-slide-error">
        Unknown component <code>{name}</code>. Register it in
        <code> registry/componentsRegistry.ts</code>.
      </div>
    );
  }
  return <Component {...(props ?? {})} />;
};

export const Block = ({
  block,
  fragments,
}: {
  block: BlockSpec;
  fragments?: boolean;
}): JSX.Element => {
  switch (block.type) {
    case 'text':
      return <>{paragraphs(block.content)}</>;
    case 'bullets':
      return <Bullets items={block.items} icon={block.icon} fragments={fragments} />;
    case 'metrics':
      return <Metrics metrics={block.metrics} fragments={fragments} />;
    case 'code':
      return (
        <CodeBlock
          code={block.code}
          language={block.language}
          lineNumbers={block.lineNumbers}
          caption={block.caption}
        />
      );
    case 'mermaid':
      return <MermaidDiagram diagram={block.diagram} caption={block.caption} />;
    case 'image':
      return (
        <figure className={`dla-figure${block.fit === 'cover' ? ' dla-figure--cover' : ''}`}>
          <img src={block.src} alt={block.alt ?? ''} />
          {block.caption && <figcaption>{inline(block.caption)}</figcaption>}
        </figure>
      );
    case 'component':
      return <NamedComponent name={block.component} props={block.props} />;
    case 'stack':
      return (
        <div className="dla-stack">
          {block.blocks.map((inner, position) => (
            <Block key={`${position}-${inner.type}`} block={inner} fragments={fragments} />
          ))}
        </div>
      );
    default:
      return (
        <div className="dla-slide-error">
          Unknown block type <code>{(block as { type: string }).type}</code>.
        </div>
      );
  }
};

/**
 * `className` is forwarded because `stepped` reveals a column by cloning it
 * with Reveal's `fragment` class on top; a component that swallowed the prop
 * would silently never step.
 */
export const Column = ({
  column,
  className,
  fragments,
}: {
  column: ColumnSpec;
  className?: string;
  fragments?: boolean;
}): JSX.Element => (
  <div className={className ? `dla-column ${className}` : 'dla-column'}>
    {column.heading && <div className="dla-column-heading">{inline(column.heading)}</div>}
    <Block block={column} fragments={fragments} />
  </div>
);
