// Atrapa Supabase działająca w prawdziwej przeglądarce (test wyglądu). Dane trzymane w pamięci strony.
export const db = window.__db = { profiles: [{ id: "u1", name: "", name_vocative: "", native: "pl", job: "", city: "", about: "", interests: [], goal: "", budget_usd: 5, remind: true, remind_at: "19:00", onboarded: false }],
  user_languages: [], bank: [], lessons: [], usage: [], grammar: [], mistakes: [] };
let nextId = 1;
function table(name) {
  const rows = db[name];
  const st = { filters: [], op: "select", payload: null, one: false,
    select() { return st; }, eq(k, v) { st.filters.push(r => r[k] === v); return st; }, gte() { return st; }, not(k) { st.filters.push(r => r[k] != null); return st; }, order() { return st; }, limit() { return st; },
    single() { st.one = true; return st; },
    update(p) { st.op = "update"; st.payload = p; return st; }, upsert(p) { st.op = "upsert"; st.payload = p; return st; }, insert(p) { st.op = "insert"; st.payload = p; return st; },
    then(res, rej) {
      let out;
      if (st.op === "update") { rows.filter(r => st.filters.every(f => f(r))).forEach(r => Object.assign(r, st.payload)); out = { data: null, error: null }; }
      else if (st.op === "upsert" || st.op === "insert") { const p = { id: nextId++, ...st.payload }; rows.push(p); out = { data: st.one ? p : [p], error: null }; }
      else { const d = rows.filter(r => st.filters.every(f => f(r))); out = { data: st.one ? d[0] : d, error: null }; }
      return Promise.resolve(out).then(res, rej);
    } };
  return st;
}
export function createClient() {
  return { from: table, auth: { getSession: async () => ({ data: { session: { user: { id: "u1", email: "test@staysi" }, access_token: "t" } } }), onAuthStateChange() {}, signOut: async () => {}, signInWithPassword: async () => ({}) } };
}
