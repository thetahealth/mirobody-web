// language code
// https://github.com/Byaidu/PDFMathTranslate/wiki/Language-Codes----%E8%AF%AD%E8%A8%80%E4%BB%A3%E7%A0%81
export const LANGUAGE_CODE = {
  EN: "en",
  ZH_CN: "zh-CN",
  // zh-TW, not a generic zh-Hant: the copy is written for Taiwan usage
  // (資料/檔案/登入, and 血紅素 rather than 血紅蛋白 for haemoglobin), which is
  // word choice and not a character conversion of zh-CN.
  ZH_TW: "zh-TW",
  JA: "ja",
  FR: "fr",
  ES: "es",
};

// support language list
export const LANGUAGE_LIST = [
  {
    code: LANGUAGE_CODE.EN,
    name: "English",
  },
  {
    code: LANGUAGE_CODE.ZH_CN,
    name: "简体中文",
  },
  {
    code: LANGUAGE_CODE.ZH_TW,
    name: "繁體中文",
  },
  {
    code: LANGUAGE_CODE.JA,
    name: "日本語",
  },
  // {
  //   code: LANGUAGE_CODE.FR,
  //   name: "Français",
  // },
  // {
  //   code: LANGUAGE_CODE.ES,
  //   name: "Español",
  // },
];
