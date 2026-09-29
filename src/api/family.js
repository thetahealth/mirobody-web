import { mcpRequestInstance } from "../service/request";

// Family / member management (frontend-only; uses existing backend endpoints).
//
// Note on directions: a created member is a th_share_relationship where I am
// the OWNER. `/api/beneficiary-users` only lists the reverse direction (people
// who shared with me), so members created here are sourced from
// `/invitation/shared-by-me/list` and merged into the beneficiary list in the
// account store. The "ask on their behalf" permission gate authorizes
// owner→member, so once
// merged they are usable.

/* create a virtual member (someone whose record you keep). The server mints
   their placeholder address; they get their own login through an activation
   link (createActivation). */
export const createVirtualUser = ({ name, gender, birth, blood }) => {
  const body = { name };
  if (gender !== undefined && gender !== null) body.gender = gender;
  if (birth) body.birth = birth;
  if (blood) body.blood = blood;
  return mcpRequestInstance.post("/api/user/virtual", body);
};

/* members I manage (owner→member):
   { members: [{ share_id, query_user_id, nickname, email, status, ... }] } */
export const listSharedByMe = (signal) =>
  mcpRequestInstance.post("/invitation/shared-by-me/list", {}, { signal });

/* remove a managed member (revoke the relationship I own) */
export const removeSharedByMe = ({ share_id, query_user_id }) =>
  mcpRequestInstance.post("/invitation/shared-by-me/remove", {
    share_id,
    query_user_id,
  });

/* a one-time link that hands a virtual member's account to them:
   { url, expires_at, sends_mail } */
export const createActivation = ({ member_id, email }) =>
  mcpRequestInstance.post("/account/activation", { member_id, email });

/* what an activation link is for: { member_name, creator_name, email,
   expires_at, sends_mail } */
export const activationInfo = (token) =>
  mcpRequestInstance.post("/account/activation/info", { token });

/* prove the address and take the account; returns the sign-in payload.
   access: "edit" | "view" | "none", what the person who added you keeps */
export const completeActivation = ({ token, code, password, access }) =>
  mcpRequestInstance.post("/account/activation/complete", {
    token,
    code,
    password,
    access,
  });

/* circles I belong to: { circles: [{ circle_id, owner_name, role,
   health_access }], ... } */
export const listSharedWithMe = (signal) =>
  mcpRequestInstance.post("/invitation/shared-with-me/list", {}, { signal });

/* what my record shows one circle: 0 none, 1 view, 2 view and edit */
export const setHealthAccess = ({ circle_id, access }) =>
  mcpRequestInstance.post("/invitation/health-access", { circle_id, access });
