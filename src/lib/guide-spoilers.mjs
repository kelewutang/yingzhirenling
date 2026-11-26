import { spoilerProtectionApplies } from './spoilers.mjs';

// Compile historical Markdown spoiler wrappers into ordinary static content.
// Other details (for example FAQs) keep their native disclosure behavior.
export function openGuideSpoilers() {
  const wrappers = [];
  return {
    name: 'released-open-guide-spoilers',
    raw(node, context) {
      if (spoilerProtectionApplies()) return;
      const value = node.value.replace(/<details\b[^>]*>|<\/details\s*>|<summary\b[^>]*>[\s\S]*?<\/summary\s*>/gi, (tag) => {
        if (/^<summary/i.test(tag)) return wrappers.at(-1) ? '' : tag;
        if (/^<\/details/i.test(tag)) return wrappers.pop() ? '</div>' : tag;
        const major = /\bdata-spoiler-level=["']major["']/i.test(tag);
        wrappers.push(major);
        return major ? '<div class="guide-open-content">' : tag;
      });
      if (value !== node.value) context.replaceNode(node, { ...node, value });
    }
  };
}
