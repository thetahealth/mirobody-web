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

// `{base_url, served: [{id, status}], models}`: what a local model server
// serves, at `baseUrl` or at the first of the usual addresses that answers, so
// the page can offer its models by name. It takes the token because it makes
// the server send a request to an address the caller names. Each address gets
// a few seconds, and there are up to three.
export const findLocalServer = (baseUrl, token, signal) => {
  return mcpRequestInstance.get("/api/setup/local", {
    params: baseUrl ? { base_url: baseUrl } : {},
    signal,
    headers: token ? { "X-Setup-Token": token } : {},
    timeout: 60000,
    sensitive: true,
  });
};

// `{mode: "key", name, value, model?, utils_model?}` or `{mode: "local",
// base_url, model?, ocr_model?}`; a model name only where the person changed
// it (pages/Setup/setup.js). A key is kept only after one real request through
// it works, and a local address only when the server there serves the models;
// the request waits up to 90 s on the vendor, hence the timeout.
export const saveSetup = (body, token) => {
  return mcpRequestInstance.post("/api/setup", body, {
    headers: { "X-Setup-Token": token },
    timeout: 120000,
    sensitive: true,
  });
};
