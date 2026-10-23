import { memo } from 'react';
import { Markdown } from '@openai/apps-sdk-ui/components/Markdown';
import { safeUrl } from './schema';

const link = (url: string) => url.startsWith('#') ? url : safeUrl(url);
const components = { a: ({ children, node: _node, ...props }: { children?: React.ReactNode; node?: unknown; href?: string }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>, img: () => null };
/** Markdown inside rich components: no HTML, no images, safe links. */
export const InlineMarkdown = memo(function InlineMarkdown({ text }: { text: string }) {
  return <Markdown className="r-markdown" skipHtml urlTransform={link} components={components}>{text}</Markdown>;
});
