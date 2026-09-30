// What the "connect a source" tab shows. Before the provider list's first
// answer it is "pending", not "empty": a deployment with Oura configured
// otherwise told its user, for as long as the request took, that there was
// nothing to connect.
export const sourcesView = ({ enabled, count, loading, answered }) => {
  if (!enabled) return "empty";
  if (count > 0) return "list";
  if (loading || !answered) return "pending";
  return "empty";
};
