import consola from "consola";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Format timezone offset to GMT string
 * @param {number} offsetMinutes - Offset in minutes
 * @returns {string} Formatted GMT string like "(GMT+08:00)"
 */
function formatGMTOffset(offsetMinutes) {
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes >= 0 ? "+" : "-";
  return `(GMT${sign}${String(hours).padStart(2, "0")}:${String(
    minutes,
  ).padStart(2, "0")})`;
}

/**
 * Get timezone display name based on language
 * @param {string} timezone - Timezone identifier (e.g., "Asia/Shanghai")
 * @param {string} language - Language code (e.g., "zh-CN", "en")
 * @returns {string} Localized timezone name
 */
function getTimezoneDisplayName(timezone, language) {
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat(language, {
      timeZone: timezone,
      timeZoneName: "long",
    });
    const parts = formatter.formatToParts(date);
    const timeZoneNamePart = parts.find((part) => part.type === "timeZoneName");
    return timeZoneNamePart ? timeZoneNamePart.value : timezone;
  } catch {
    return timezone;
  }
}

/**
 * Common city name mapping for Chinese display
 * Only includes cities that need special translation
 */
const CITY_NAME_MAP_ZH = {
  // Asia
  Shanghai: "北京", // China Standard Time uses Beijing as the representative city
  Beijing: "北京",
  Hong_Kong: "香港",
  Macau: "澳门",
  Taipei: "台北",
  Tokyo: "东京",
  Seoul: "首尔",
  Jakarta: "雅加达",
  Bangkok: "曼谷",
  Singapore: "新加坡",
  Dubai: "迪拜",
  Mumbai: "孟买",
  Kolkata: "加尔各答",
  Dhaka: "达卡",
  Yangon: "仰光",
  Ho_Chi_Minh: "胡志明市",
  Manila: "马尼拉",
  Kuala_Lumpur: "吉隆坡",
  Phnom_Penh: "金边",
  Vientiane: "万象",
  Ulaanbaatar: "乌兰巴托",
  Almaty: "阿拉木图",
  Tashkent: "塔什干",
  Baku: "巴库",
  Yerevan: "埃里温",
  Tbilisi: "第比利斯",
  Baghdad: "巴格达",
  Riyadh: "利雅得",
  Tehran: "德黑兰",
  Jerusalem: "耶路撒冷",
  Amman: "安曼",
  Beirut: "贝鲁特",
  Damascus: "大马士革",
  Kuwait: "科威特",
  Muscat: "马斯喀特",
  Qatar: "多哈",
  Kabul: "喀布尔",
  Karachi: "卡拉奇",
  Islamabad: "伊斯兰堡",
  Kathmandu: "加德满都",
  Thimphu: "廷布",
  Colombo: "科伦坡",
  Maldives: "马累",
  // Americas
  New_York: "纽约",
  Chicago: "芝加哥",
  Denver: "丹佛",
  Los_Angeles: "洛杉矶",
  Toronto: "多伦多",
  Vancouver: "温哥华",
  Mexico_City: "墨西哥城",
  Sao_Paulo: "圣保罗",
  Buenos_Aires: "布宜诺斯艾利斯",
  Lima: "利马",
  Bogota: "波哥大",
  Santiago: "圣地亚哥",
  Caracas: "加拉加斯",
  // Europe
  London: "伦敦",
  Paris: "巴黎",
  Berlin: "柏林",
  Rome: "罗马",
  Madrid: "马德里",
  Amsterdam: "阿姆斯特丹",
  Brussels: "布鲁塞尔",
  Vienna: "维也纳",
  Zurich: "苏黎世",
  Stockholm: "斯德哥尔摩",
  Oslo: "奥斯陆",
  Copenhagen: "哥本哈根",
  Helsinki: "赫尔辛基",
  Warsaw: "华沙",
  Prague: "布拉格",
  Budapest: "布达佩斯",
  Athens: "雅典",
  Istanbul: "伊斯坦布尔",
  Moscow: "莫斯科",
  Kiev: "基辅",
  // Oceania
  Sydney: "悉尼",
  Melbourne: "墨尔本",
  Brisbane: "布里斯班",
  Perth: "珀斯",
  Adelaide: "阿德莱德",
  Darwin: "达尔文",
  Auckland: "奥克兰",
  Honolulu: "火奴鲁鲁",
  // Africa
  Cairo: "开罗",
  Johannesburg: "约翰内斯堡",
  Lagos: "拉各斯",
  Nairobi: "内罗毕",
  Casablanca: "卡萨布兰卡",
};

/**
 * Get city name from timezone identifier with localization
 * @param {string} timezone - Timezone identifier (e.g., "Asia/Shanghai")
 * @param {string} language - Language code (e.g., "zh-CN", "en")
 * @returns {string} Localized city name
 */
function getCityName(timezone, language) {
  const parts = timezone.split("/");
  if (parts.length > 1) {
    const cityKey = parts[parts.length - 1];

    // Use Chinese mapping if available and language is zh-CN
    if (language === "zh-CN" && CITY_NAME_MAP_ZH[cityKey]) {
      return CITY_NAME_MAP_ZH[cityKey];
    }

    // Fallback to formatted city name (replace underscores with spaces)
    return cityKey.replace(/_/g, " ");
  }
  return timezone;
}

/**
 * Major cities timezone whitelist
 * Only include commonly used timezones for major cities
 */
const MAJOR_CITIES_TIMEZONES = [
  // GMT+13
  "Pacific/Auckland", // New Zealand Time
  // GMT+11
  "Australia/Sydney", // Australian Eastern Time
  "Australia/Melbourne", // Australian Eastern Time
  // GMT+10.5
  "Australia/Adelaide", // Australian Central Time
  // GMT+10
  "Australia/Brisbane", // Australian Eastern Time
  // GMT+9.5
  "Australia/Darwin", // Australian Central Time
  // GMT+9
  "Asia/Tokyo", // Japan Standard Time
  "Asia/Seoul", // Korea Standard Time
  // GMT+8
  "Asia/Shanghai", // China Standard Time
  "Asia/Hong_Kong", // Hong Kong Time
  "Asia/Macau", // Macau Time
  "Asia/Taipei", // Taiwan Time
  "Asia/Singapore", // Singapore Time
  "Asia/Kuala_Lumpur", // Malaysia Time
  "Asia/Manila", // Philippine Time
  "Asia/Ulaanbaatar", // Ulaanbaatar Time
  "Australia/Perth", // Australian Western Time
  // GMT+7
  "Asia/Bangkok", // Indochina Time
  "Asia/Jakarta", // Western Indonesia Time
  "Asia/Ho_Chi_Minh", // Indochina Time
  "Asia/Phnom_Penh", // Indochina Time
  "Asia/Vientiane", // Indochina Time
  // GMT+6.5
  "Asia/Yangon", // Myanmar Time
  // GMT+6
  "Asia/Dhaka", // Bangladesh Time
  "Asia/Thimphu", // Bhutan Time
  // GMT+5.75
  "Asia/Kathmandu", // Nepal Time
  // GMT+5.5
  "Asia/Kolkata", // India Standard Time
  "Asia/Colombo", // Sri Lanka Time
  // GMT+5
  "Asia/Karachi", // Pakistan Time
  "Asia/Almaty", // Alma-Ata Time
  "Asia/Tashkent", // Uzbekistan Time
  // GMT+4.5
  "Asia/Kabul", // Afghanistan Time
  // GMT+4
  "Asia/Dubai", // Gulf Standard Time
  "Asia/Muscat", // Gulf Standard Time
  "Asia/Baku", // Azerbaijan Time
  "Asia/Yerevan", // Armenia Time
  "Asia/Tbilisi", // Georgia Time
  // GMT+3.5
  "Asia/Tehran", // Iran Standard Time
  // GMT+3
  "Europe/Istanbul", // TRT
  "Europe/Moscow", // MSK
  "Asia/Riyadh", // Arabia Standard Time
  "Asia/Baghdad", // Arabia Standard Time
  "Asia/Amman", // Eastern European Time
  "Asia/Damascus", // Eastern European Time
  "Asia/Kuwait", // Arabia Standard Time
  "Africa/Nairobi", // East Africa Time
  // GMT+2
  "Europe/Helsinki", // EET/EEST
  "Europe/Athens", // EET/EEST
  "Europe/Kiev", // EET/EEST
  "Asia/Jerusalem", // Israel Standard Time
  "Asia/Beirut", // Eastern European Time
  "Africa/Cairo", // Eastern European Time
  "Africa/Johannesburg", // South Africa Standard Time
  // GMT+1
  "Europe/Paris", // CET/CEST
  "Europe/Berlin", // CET/CEST
  "Europe/Rome", // CET/CEST
  "Europe/Madrid", // CET/CEST
  "Europe/Amsterdam", // CET/CEST
  "Europe/Brussels", // CET/CEST
  "Europe/Vienna", // CET/CEST
  "Europe/Zurich", // CET/CEST
  "Europe/Stockholm", // CET/CEST
  "Europe/Oslo", // CET/CEST
  "Europe/Copenhagen", // CET/CEST
  "Europe/Warsaw", // CET/CEST
  "Europe/Prague", // CET/CEST
  "Europe/Budapest", // CET/CEST
  "Africa/Lagos", // West Africa Time
  "Africa/Casablanca", // Western European Time
  // GMT+5
  "Indian/Maldives", // Maldives Time
  // GMT+3
  "Asia/Qatar", // Arabia Standard Time (Doha)
  // GMT+0
  "UTC",
  "Europe/London", // GMT/BST
  // GMT-3
  "America/Sao_Paulo", // Brasilia Time
  "America/Buenos_Aires", // Argentina Time
  "America/Santiago", // Chile Time
  // GMT-4
  "America/Caracas", // Venezuela Time
  // GMT-5
  "America/New_York", // Eastern Time
  "America/Toronto", // Eastern Time (Canada)
  "America/Lima", // Peru Time
  "America/Bogota", // Colombia Time
  // GMT-6
  "America/Chicago", // Central Time
  "America/Mexico_City", // Central Time (Mexico)
  // GMT-7
  "America/Denver", // Mountain Time
  // GMT-8
  "America/Los_Angeles", // Pacific Time
  "America/Vancouver", // Pacific Time (Canada)
  // GMT-10
  "Pacific/Honolulu", // Hawaii-Aleutian Time
];

/**
 * Timezone city name mappings
 * Cities in the same timezone group share search terms
 * This allows searching by any city name to find the corresponding timezone option
 */
export const TIMEZONE_CITY_GROUPS = {
  // China Standard Time (GMT+8) - Asia/Shanghai
  "Asia/Shanghai": {
    en: [
      "shanghai",
      "beijing",
      "chongqing",
      "guangzhou",
      "shenzhen",
      "chengdu",
    ],
    zh: ["北京", "上海", "重庆", "广州", "深圳", "成都"],
  },
  // Central European Time (GMT+1) - CET/CEST
  "Europe/Paris": {
    en: [
      "paris",
      "berlin",
      "rome",
      "madrid",
      "amsterdam",
      "brussels",
      "vienna",
      "zurich",
      "stockholm",
      "oslo",
      "copenhagen",
      "warsaw",
      "prague",
      "budapest",
    ],
    zh: [
      "巴黎",
      "柏林",
      "罗马",
      "马德里",
      "阿姆斯特丹",
      "布鲁塞尔",
      "维也纳",
      "苏黎世",
      "斯德哥尔摩",
      "奥斯陆",
      "哥本哈根",
      "华沙",
      "布拉格",
      "布达佩斯",
    ],
  },
  // Eastern Time (GMT-5) - America/New_York, America/Toronto
  "America/New_York": {
    en: ["new york", "toronto", "ny", "nyc"],
    zh: ["纽约", "多伦多"],
  },
  // Central Time (GMT-6) - America/Chicago, America/Mexico_City
  "America/Chicago": {
    en: ["chicago", "mexico city", "mexico"],
    zh: ["芝加哥", "墨西哥城"],
  },
  // Pacific Time (GMT-8) - America/Los_Angeles, America/Vancouver
  "America/Los_Angeles": {
    en: ["los angeles", "vancouver", "la", "san francisco", "seattle"],
    zh: ["洛杉矶", "温哥华", "旧金山", "西雅图"],
  },
  // Australian Eastern Time (GMT+10/11) - Australia/Sydney, Australia/Melbourne
  "Australia/Sydney": {
    en: ["sydney", "melbourne"],
    zh: ["悉尼", "墨尔本"],
  },
  // Arabia Standard Time (GMT+3) - Asia/Riyadh, Asia/Baghdad, Asia/Kuwait
  "Asia/Riyadh": {
    en: ["riyadh", "baghdad", "kuwait"],
    zh: ["利雅得", "巴格达", "科威特"],
  },
  // Gulf Standard Time (GMT+4) - Asia/Dubai, Asia/Muscat
  "Asia/Dubai": {
    en: ["dubai", "muscat", "abu dhabi"],
    zh: ["迪拜", "马斯喀特", "阿布扎比"],
  },
  // Arabia Standard Time (GMT+3) - Asia/Qatar
  "Asia/Qatar": {
    en: ["doha", "qatar"],
    zh: ["多哈", "卡塔尔"],
  },
  // Maldives Time (GMT+5) - Indian/Maldives
  "Indian/Maldives": {
    en: ["male", "maldives"],
    zh: ["马累", "马尔代夫"],
  },
  // India Standard Time (GMT+5.5) - Asia/Kolkata, Asia/Colombo
  "Asia/Kolkata": {
    en: ["kolkata", "colombo", "mumbai", "delhi"],
    zh: ["加尔各答", "科伦坡", "孟买", "德里"],
  },
  // Eastern European Time (GMT+2) - Europe/Helsinki, Europe/Athens, Europe/Kiev, Africa/Cairo
  "Europe/Helsinki": {
    en: ["helsinki", "athens", "kiev", "kyiv", "cairo"],
    zh: ["赫尔辛基", "雅典", "基辅", "开罗"],
  },
};

/**
 * Build timezone search maps for filtering
 * @returns {Object} Object containing cityNameToTimezones and timezoneToCityGroup
 */
export function buildTimezoneSearchMaps() {
  const cityNameToTimezones = {}; // Map city name to timezone identifiers
  const timezoneToCityGroup = {}; // Map timezone to its city group

  Object.entries(TIMEZONE_CITY_GROUPS).forEach(([timezoneKey, group]) => {
    const allTerms = [...group.en, ...group.zh];
    const timezonesInGroup = [timezoneKey];

    // Map the primary timezone key
    timezoneToCityGroup[timezoneKey] = allTerms;

    // Map other timezones in the same group
    // For Central European Time, map all CET/CEST timezones
    if (timezoneKey === "Europe/Paris") {
      const cetTimezones = [
        "Europe/Paris",
        "Europe/Berlin",
        "Europe/Rome",
        "Europe/Madrid",
        "Europe/Amsterdam",
        "Europe/Brussels",
        "Europe/Vienna",
        "Europe/Zurich",
        "Europe/Stockholm",
        "Europe/Oslo",
        "Europe/Copenhagen",
        "Europe/Warsaw",
        "Europe/Prague",
        "Europe/Budapest",
      ];
      timezonesInGroup.push(...cetTimezones);
      cetTimezones.forEach((tz) => {
        timezoneToCityGroup[tz] = allTerms;
      });
    }
    // For Eastern Time, map both New York and Toronto
    else if (timezoneKey === "America/New_York") {
      timezonesInGroup.push("America/Toronto");
      timezoneToCityGroup["America/Toronto"] = allTerms;
    }
    // For Pacific Time, map both Los Angeles and Vancouver
    else if (timezoneKey === "America/Los_Angeles") {
      timezonesInGroup.push("America/Vancouver");
      timezoneToCityGroup["America/Vancouver"] = allTerms;
    }
    // For Australian Eastern Time, map both Sydney and Melbourne
    else if (timezoneKey === "Australia/Sydney") {
      timezonesInGroup.push("Australia/Melbourne");
      timezoneToCityGroup["Australia/Melbourne"] = allTerms;
    }
    // For Arabia Standard Time
    else if (timezoneKey === "Asia/Riyadh") {
      timezonesInGroup.push("Asia/Baghdad", "Asia/Kuwait");
      timezoneToCityGroup["Asia/Baghdad"] = allTerms;
      timezoneToCityGroup["Asia/Kuwait"] = allTerms;
    }
    // For Gulf Standard Time
    else if (timezoneKey === "Asia/Dubai") {
      timezonesInGroup.push("Asia/Muscat");
      timezoneToCityGroup["Asia/Muscat"] = allTerms;
    }
    // For India Standard Time
    else if (timezoneKey === "Asia/Kolkata") {
      timezonesInGroup.push("Asia/Colombo");
      timezoneToCityGroup["Asia/Colombo"] = allTerms;
    }
    // For Eastern European Time
    else if (timezoneKey === "Europe/Helsinki") {
      timezonesInGroup.push("Europe/Athens", "Europe/Kiev", "Africa/Cairo");
      timezoneToCityGroup["Europe/Athens"] = allTerms;
      timezoneToCityGroup["Europe/Kiev"] = allTerms;
      timezoneToCityGroup["Africa/Cairo"] = allTerms;
    }

    // Build city name to timezones map
    allTerms.forEach((city) => {
      const cityLower = city.toLowerCase();
      if (!cityNameToTimezones[cityLower]) {
        cityNameToTimezones[cityLower] = [];
      }
      if (!cityNameToTimezones[city]) {
        cityNameToTimezones[city] = [];
      }
      // Add all timezones in this group
      timezonesInGroup.forEach((tz) => {
        if (!cityNameToTimezones[cityLower].includes(tz)) {
          cityNameToTimezones[cityLower].push(tz);
        }
        if (!cityNameToTimezones[city].includes(tz)) {
          cityNameToTimezones[city].push(tz);
        }
      });
    });
  });

  return {
    cityNameToTimezones,
    timezoneToCityGroup,
  };
}

/**
 * Get timezone list grouped by language
 * @param {string} language - Language code (e.g., "zh-CN", "en")
 * @returns {Array} Array of timezone options for Select component
 */
export function TIMEZONE_LANG_MAP(language = "en") {
  const timezoneOptions = [];

  // Iterate in the order defined in MAJOR_CITIES_TIMEZONES to maintain correct sorting
  MAJOR_CITIES_TIMEZONES.forEach((tz) => {
    try {
      // Use dayjs to get timezone offset (returns offset in minutes)
      const offsetMinutes = dayjs().tz(tz).utcOffset();
      const gmtOffset = formatGMTOffset(offsetMinutes);
      const timezoneName = getTimezoneDisplayName(tz, language);
      const cityName = getCityName(tz, language);

      // Format: (GMT+08:00) <zone name> - <city>
      const label = `${gmtOffset} ${timezoneName} - ${cityName}`;

      timezoneOptions.push({
        label: label,
        value: tz,
      });
    } catch (error) {
      // Skip invalid timezones
      consola.warn(`Invalid timezone: ${tz}`, error);
    }
  });

  return timezoneOptions;
}
