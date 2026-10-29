const LOCAL_FRONTENDS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function originPolicy(configured: string, production: boolean) {
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('WEB_ORIGIN must be an absolute HTTP or HTTPS origin.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('WEB_ORIGIN must contain only an HTTP(S) scheme, hostname and optional port.');
  const canonical = url.origin;
  const allowed = new Set([canonical, ...(production ? [] : LOCAL_FRONTENDS)]);
  return { canonical, allows: (origin: string | undefined) => !!origin && allowed.has(origin) };
}
