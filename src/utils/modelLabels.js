// `GET /api/models?labels=1`: the entries the chat may run on, each as
// `{name, model}`. Framework-free so it unit-tests under the node-env vitest.
//
// An entry's NAME ("local", "openrouter") is what a chat request sends and what
// a saved selection holds. The MODEL it runs ("qwen3.8-27b") is what a person
// knows it by, and with the first-run page choosing the model, the name alone
// no longer says which one answers: "local" is whatever the deployment's own
// server runs. So the picker shows the model and still sends the name.

/**
 * One entry of the list, as the picker holds it. `id` and `provider` are the
 * entry's name (what the request sends; a selection saved before labels
 * existed still matches it). `show_name` is the model when the server named
 * one, else the name. A bare string is an entry from a server that answers
 * without `labels`.
 *
 * @param {string | {name?: string, model?: string}} entry
 * @returns {{ id: string, provider: string, show_name: string }}
 */
export const parseModelEntry = (entry) => {
  const name = typeof entry === "string" ? entry : entry?.name || "";
  const model = typeof entry === "string" ? "" : entry?.model || "";
  return { id: name, provider: name, show_name: model || name };
};
