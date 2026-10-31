import { createContext, useContext } from "react";

// The conversation the answers on screen belong to, so an anchor knows where
// to resolve its rid. A page with no conversation (a public share) provides
// none, and its answers are drawn without any citation marks: there is no
// source a visitor could open.
export const CitationSessionContext = createContext("");

export const useCitationSession = () => useContext(CitationSessionContext);

// One answer's cite groups and which of them is open: every anchor of the
// open group is lit, wherever in the answer it is.
export const CiteGroupsContext = createContext(null);

export const useCiteGroups = () => useContext(CiteGroupsContext);
