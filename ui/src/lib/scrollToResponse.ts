/**
 * After a "Try it out" execution, scroll the newest response into view.
 * Tries multiple selectors because each renderer uses its own class names.
 * rAF + timeout gives the renderer time to mount the response.
 */
export const scrollToLastResponse = (containerEl: HTMLElement | null) => {
  if (!containerEl) return;
  requestAnimationFrame(() => {
    window.setTimeout(() => {
      const candidates = [
        '.live-responses-table',
        '.opblock.is-open .responses-wrapper',
        '.sl-elements-http-operation-response',
        '[data-scalar-response]',
        '.scalar-response',
      ];
      for (const sel of candidates) {
        const els = containerEl.querySelectorAll(sel);
        if (els.length > 0) {
          (els[els.length - 1] as HTMLElement).scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
          return;
        }
      }
    }, 250);
  });
};