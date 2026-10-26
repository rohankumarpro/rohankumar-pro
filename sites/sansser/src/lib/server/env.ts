// Which database a request may touch. Previews, branch deploys and localhost use the sandbox and
// can never write to production. Production is only the real site hosts.
const PROD_HOSTS = new Set(["link.sansser.com", "sansser.com", "www.sansser.com"]);

export function isProduction(url: URL) {
  return PROD_HOSTS.has(url.hostname);
}

export function dbConfig(url: URL) {
  const prod = isProduction(url);
  const base = (prod ? process.env.SUPABASE_URL : process.env.SUPABASE_URL_SANDBOX) || "";
  const key = (prod ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY_SANDBOX) || "";
  return { base, key, prod };
}
