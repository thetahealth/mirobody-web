// gender — the values the backend stores. It normalises anything it does not
// recognise to "other", so offering a third option is the difference between
// "unspecified" being a choice and being the silent result of a rejected one.
export const GENDER_OPTIONS = [
  {
    label: "male", // Will be translated in component
    value: "male",
  },
  {
    label: "female", // Will be translated in component
    value: "female",
  },
  {
    label: "gender_other", // Will be translated in component
    value: "other",
  },
];

// blood type — the four basic ABO groups
export const BLOOD_TYPE_OPTIONS = [
  {
    label: "A",
    value: "A",
  },
  {
    label: "B",
    value: "B",
  },
  {
    label: "AB",
    value: "AB",
  },
  {
    label: "O",
    value: "O",
  },
];
