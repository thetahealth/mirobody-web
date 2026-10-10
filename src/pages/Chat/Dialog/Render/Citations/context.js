import { createContext, useContext } from "react";

// The conversation the answers on screen belong to, so a chip knows where to
// resolve its rid. A page with no conversation (a public share) provides none,
// and its chips show the cite without looking it up.
export const CitationSessionContext = createContext("");

export const useCitationSession = () => useContext(CitationSessionContext);
