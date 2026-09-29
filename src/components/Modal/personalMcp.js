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
