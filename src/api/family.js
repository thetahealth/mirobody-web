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

/* create a virtual member (a managed person who never logs in) */
export const createVirtualUser = ({ name, email, gender, birth, blood }) => {
  const body = { name, email };
  if (gender !== undefined && gender !== null) body.gender = gender;
  if (birth) body.birth = birth;
  if (blood) body.blood = blood;
  return mcpRequestInstance.post("/api/user/virtual", body);
};

/* members I manage (owner→member): [{ share_id, query_user_id, nickname, email, status, ... }] */
export const listSharedByMe = (signal) =>
  mcpRequestInstance.post("/invitation/shared-by-me/list", {}, { signal });

/* remove a managed member (revoke the relationship I own) */
export const removeSharedByMe = ({ share_id, query_user_id }) =>
  mcpRequestInstance.post("/invitation/shared-by-me/remove", {
    share_id,
    query_user_id,
  });
