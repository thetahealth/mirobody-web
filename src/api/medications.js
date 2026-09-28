import { mcpRequestInstance } from "../service/request";

const BASE = "/api/v1/medications";

export const listMedications = ({ target_user_id, status } = {}, signal) =>
  mcpRequestInstance.get(BASE, { params: { target_user_id, status }, signal });

export const getMedication = (planId, signal) =>
  mcpRequestInstance.get(`${BASE}/${encodeURIComponent(planId)}`, { signal });

export const createMedication = (body, signal) =>
  mcpRequestInstance.post(BASE, body, { signal });

export const updateMedication = (planId, body, signal) =>
  mcpRequestInstance.patch(`${BASE}/${encodeURIComponent(planId)}`, body, { signal });

export const stopMedication = (planId, signal) =>
  mcpRequestInstance.post(`${BASE}/${encodeURIComponent(planId)}/stop`, {}, { signal });

export const resumeMedication = (planId, signal) =>
  mcpRequestInstance.post(`${BASE}/${encodeURIComponent(planId)}/resume`, {}, { signal });

export const deleteMedication = (planId, signal) =>
  mcpRequestInstance.delete(`${BASE}/${encodeURIComponent(planId)}`, { signal });
