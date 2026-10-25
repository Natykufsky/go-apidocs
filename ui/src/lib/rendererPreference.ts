export type RendererChoice = 'swagger' | 'scalar';

const KEY = 'apidocs_renderer';
const VALID: RendererChoice[] = ['swagger', 'scalar'];

export const getRendererPreference = (): RendererChoice => {
  try {
    const v = localStorage.getItem(KEY) as RendererChoice | null;
    if (v && VALID.includes(v)) return v;
  } catch {}
  return 'swagger';
};

export const setRendererPreference = (r: RendererChoice) => {
  try {
    localStorage.setItem(KEY, r);
  } catch {}
};