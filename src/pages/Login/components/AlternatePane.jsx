import SocialButtons from "./SocialButtons";

/**
 * Alternate login pane. The parent resolves `methods` (via resolveAltMethods)
 * and owns the action handlers; this renders the social surface when the
 * deployment has any provider configured, and nothing when it doesn't.
 */
export default function AlternatePane({
  methods,
  onGoogle,
  onApple,
  googleLoading,
  appleLoading,
}) {
  if (methods.google || methods.apple) {
    return (
      <SocialButtons
        showGoogle={methods.google}
        showApple={methods.apple}
        onGoogle={onGoogle}
        onApple={onApple}
        googleLoading={googleLoading}
        appleLoading={appleLoading}
      />
    );
  }
  return null;
}
