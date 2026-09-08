import { mcpRequestInstance } from "../service/request";
import * as login from "./login";
import * as upload from "./upload";
import * as chat from "./chat";
import * as vital from "./vital";
import * as webauthn from "./webauthn";
import * as data from "./data";
import * as family from "./family";
import * as indicators from "./indicators";
import * as mcp from "./mcp";
/* data distribution */
export const dataDistribution = (data, signal) => {
  return mcpRequestInstance.get("/api/v1/data/data-distribution", {
    params: data,
    signal,
  });
};

export const beneficiaryUsers = (signal) => {
  return mcpRequestInstance.get(`/api/beneficiary-users`, {
    signal,
  });
};

export const getMirobodyConfig = () => {
  return mcpRequestInstance.get("/mirobody.json");
};

// user settings
export const getUserSettings = (signal) => {
  return mcpRequestInstance.get("/api/user/settings", { signal });
};

export const updateUserSettings = (data, signal) => {
  return mcpRequestInstance.post("/api/user/settings", data, { signal });
};

export default {
  dataDistribution,
  beneficiaryUsers,
  getMirobodyConfig,
  getUserSettings,
  updateUserSettings,
  ...login,
  ...upload,
  ...chat,
  ...vital,
  ...webauthn,
  ...data,
  ...family,
  ...indicators,
  ...mcp,
};
