import AppleHealthPNG from "../../../assets/apple_health.png";
import GarminPNG from "../../../assets/providers/garmin.png";
import OuraPNG from "../../../assets/providers/oura.png";
import WhoopPNG from "../../../assets/providers/whoop.png";

// The built-in providers' logos ship with the page. The provider API still
// answers with a logo URL on static.thetahealth.ai (other clients read it), but
// rendering that URL made a self-hosted page fetch an image from a server
// outside the deployment every time the sources tab listed a device.
const BUNDLED = {
  apple_health: AppleHealthPNG,
  theta_garmin: GarminPNG,
  theta_oura: OuraPNG,
  theta_whoop: WhoopPNG,
};

// A provider this page does not know, such as a deployment's own plugin, keeps
// the logo its API sends.
export const providerLogo = (datasource) =>
  BUNDLED[datasource?.slug] ?? datasource?.logo ?? null;
