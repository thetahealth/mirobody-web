import { mcpRequestInstance } from "../service/request";

/* get pulse providers */
export const getPulseProviders = ({ signal, data }) => {
  return mcpRequestInstance.get("/api/v1/pulse/providers", {
    signal,
    params: data,
  });
};

/* link pulse provider */
export const linkPulseProvider = (data) => {
  return mcpRequestInstance.post("/api/v1/pulse/user/providers/link", data);
};

/* unlink pulse provider */
export const unlinkPulseProvider = (data) => {
  return mcpRequestInstance.post("/api/v1/pulse/user/providers/unlink", data);
};

