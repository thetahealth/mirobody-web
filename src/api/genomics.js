import { mcpRequestInstance } from "../service/request";

export const getActiveGenotypeSet = ({ target_user_id, signal } = {}) =>
  mcpRequestInstance.get("/api/v1/genomics/active-set", {
    params: target_user_id ? { target_user_id } : {},
    signal,
  });
