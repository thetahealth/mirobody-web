// Flags → which alternate login methods to show alongside the email code form.
// Both come from /mirobody.json, i.e. from what the deployment actually has
// configured (Firebase / Apple credentials). Pure + framework-free so it
// unit-tests in node-env vitest.

export const resolveAltMethods = ({ showGoogle, showApple }) => ({
  google: !!showGoogle,
  apple: !!showApple,
});
