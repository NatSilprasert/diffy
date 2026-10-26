import { parseProfileMarkdown, type Inline } from '@/lib/profileMarkdown';

function Inlines({ nodes }: { nodes: Inline[] }) {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return node.value;
      case 'bold':
        return (
          <strong key={i} className="font-semibold text-foreground">
            <Inlines nodes={node.children} />
          </strong>
        );
      case 'italic':
        return (
          <em key={i} className="text-muted-foreground not-italic">
            <Inlines nodes={node.children} />
          </em>
        );
      case 'code':
        return (
          <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs break-all text-foreground/90">
            {node.value}
          </code>
        );
    }
  });
}

// The profile as the model wrote it. Built from elements, never from HTML, so nothing in the text can run.
export function ProfileMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parseProfileMarkdown(text).map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3 key={i} className="pt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase first:pt-0">
                <Inlines nodes={block.children} />
              </h3>
            );
          case 'list':
            return (
              <ul key={i} className="space-y-2">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                    <span className="min-w-0">
                      <Inlines nodes={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case 'paragraph':
            return (
              <p key={i} className="text-foreground/90">
                <Inlines nodes={block.children} />
              </p>
            );
        }
      })}
    </div>
  );
}
