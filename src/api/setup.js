import { mcpRequestInstance } from "../service/request";

// The first-run page (/setup): which model answers, a vendor's or one on this
// machine. Saving changes where health data is sent, so it takes the setup
// token (`SETUP_TOKEN` in the deployment's .env), and once a model is set up a
// signed-in session as well; the axios instance sends that one by itself.
//
// Both are `sensitive`: they carry the token, and a save carries a vendor key,
// so a failure is logged without the request (service/request.js).

// What each choice takes. Without a trusted token it says only whether a model
// is still needed: which keys are set, the model in use and the local address
// are the deployment owner's to see.
export const getSetup = (signal, token) => {
  return mcpRequestInstance.get("/api/setup", {
    signal,
    headers: token ? { "X-Setup-Token": token } : {},
    sensitive: true,
  });
};

// `{mode: "key", name, value}` or `{mode: "local", base_url}`. A key is kept
// only after one real request through it works, and a local address only when
// the server there serves the models; either can take a minute, hence the
// timeout.
export const saveSetup = (body, token) => {
  return mcpRequestInstance.post("/api/setup", body, {
    headers: { "X-Setup-Token": token },
    timeout: 120000,
    sensitive: true,
  });
};
