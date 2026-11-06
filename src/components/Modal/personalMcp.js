import dayjs from "dayjs";

// The listing as the Settings page shows it. The caller's own link is the
// one they made for themselves; links they made for a family member and links
// family members made for them are listed separately, each revocable.
export const splitLinks = (listing) => {
  const made = Array.isArray(listing?.made) ? listing.made : [];
  const holders = Array.isArray(listing?.holders) ? listing.holders : [];
  return {
    own: made.find((link) => link.own) || null,
    forOthers: made.filter((link) => !link.own),
    holders,
  };
};

export const linkDay = (iso) => (iso ? dayjs(iso).format("YYYY-MM-DD") : "");

// A person's display name, or their id when the account has none.
export const personLabel = (name, id) => (name && String(name).trim()) || `#${id}`;

// One row per record the caller can hold a link to: their own, then each
// member on the roster the record switcher shows (`beneficiary_users`, the
// people whose record the care circle lets them read), then anyone they made
// a link for who is no longer on it. A link reads one record, so a person who
// manages a parent needs the parent's row to get the parent's link; before
// rows, the page could make only the caller's own (#232).
//
// The last kind can only be revoked: the server mints a member's link only
// through `resolve_subject`, which refuses a record the circle does not let
// the caller read. Such a link is normally already dead (stopping the share
// revokes it), but a roster that failed to load must not hide one.
export const linkRows = ({ own, forOthers }, roster) => {
  const rows = [{ key: "self", own: true, subjectId: "", name: "", link: own || null, canMint: true }];
  const made = new Map((forOthers || []).map((link) => [String(link.subject_id), link]));
  const seen = new Set();
  for (const user of Array.isArray(roster) ? roster : []) {
    const id = user?.id == null ? "" : String(user.id);
    // `can_view === false`: a member the caller manages who keeps their
    // record to themselves. The roster lists them so they can be removed;
    // there is nothing for a link to read.
    if (!id || user.is_current_user || user.can_view === false || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      key: id,
      own: false,
      subjectId: id,
      // The name the caller gave them first, as the "query for" picker does.
      name: personLabel(user.nickname || user.name, id),
      link: made.get(id) || null,
      canMint: true,
    });
    made.delete(id);
  }
  for (const [id, link] of made) {
    rows.push({
      key: id,
      own: false,
      subjectId: id,
      name: personLabel(link.subject_name, id),
      link,
      canMint: false,
    });
  }
  return rows;
};
