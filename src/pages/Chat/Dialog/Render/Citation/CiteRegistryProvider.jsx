import { CiteRegistryContext, EMPTY_CITE_REGISTRY } from "./registry";

/**
 * Session-scoped citation registry for everything rendered below — the chat
 * page feeds the store's registry (indexed at frame time in
 * store/Chart/data.js), the share page builds the same value from its local
 * history state. Fallback is the empty registry: cites render "未核实",
 * visible rather than silently cleaned.
 */
export default function CiteRegistryProvider({ registry, children }) {
  return (
    <CiteRegistryContext.Provider value={registry || EMPTY_CITE_REGISTRY}>
      {children}
    </CiteRegistryContext.Provider>
  );
}
