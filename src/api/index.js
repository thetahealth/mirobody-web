import { mcpRequestInstance } from "../service/request";
import * as login from "./login";
import * as upload from "./upload";
import * as chat from "./chat";
import * as vital from "./vital";
import * as webauthn from "./webauthn";
import * as family from "./family";
import * as indicators from "./indicators";
import * as genomics from "./genomics";
import * as medications from "./medications";
import * as mcp from "./mcp";
import * as setup from "./setup";
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

/**
 * Your own basics — gender / birth / blood.
 *
 * `GET /api/user/settings` has always returned a `profile: { gender, birth,
 * blood }` block and nothing on the client ever read it, so the profile page
 * had no values to show and was written as read-only. PUT is the write side:
 * it takes the whole settings tree, so the profile block is nested under
 * `settings` (the flat `{gender, …}` shape answers 200 and persists nothing).
 *
 * The roster picks the values up: after a save, `/api/beneficiary-users`
 * reports gender and blood_type, and an `age` the server derives from `birth`
 * — which is why this asks for a birth date and shows age as a consequence.
 * That matters beyond this page: the roster is what the chat answers from.
 */
export const updateUserProfile = ({ gender, birth, blood }, signal) => {
  const profile = {};
  if (gender !== undefined) profile.gender = gender;
  if (birth !== undefined) profile.birth = birth;
  if (blood !== undefined) profile.blood = blood;
  return mcpRequestInstance.put(
    "/api/user/settings",
    { settings: { profile } },
    { signal },
  );
};

export default {
  dataDistribution,
  beneficiaryUsers,
  getMirobodyConfig,
  getUserSettings,
  updateUserSettings,
  updateUserProfile,
  ...login,
  ...upload,
  ...chat,
  ...vital,
  ...webauthn,
  ...family,
  ...indicators,
  ...genomics,
  ...medications,
  ...mcp,
  ...setup,
};
