/**
 * Is this upload a raw genotype export? The browser half of
 * `mirobody/collect/files/services/genotype_format.py`, and the same rules:
 * keep the two in step.
 *
 * It matters here because a recognised genotype file is exempt from the 20 MB
 * upload cap (a real WeGene export is 33 MB). The check used to require the
 * file to START with WeGene's banner sentence, so a 23andMe, AncestryDNA or
 * MyHeritage export of the same shape was refused as "too large" in the
 * browser and never reached the server that could read it. It also read the
 * whole file into memory to look at its first line.
 *
 * Recognised by the column header, commented or not:
 *   WeGene, 23andMe    # rsid  chromosome  position  genotype
 *   AncestryDNA        rsid  chromosome  position  allele1  allele2
 *   MyHeritage, FTDNA  RSID,CHROMOSOME,POSITION,RESULT
 * A text file that merely mentions rs-numbers is not one: a header is required.
 */

/** Bytes read to decide. 23andMe puts ~20 comment lines before its header. */
export const SNIFF_BYTES = 16 * 1024;

/**
 * MIME types a genotype export arrives as. MyHeritage's is a .csv, which
 * Windows reports as the Excel type, and an unknown extension arrives as "".
 * The header check is the real gate; this only avoids reading a PDF or photo.
 */
export const GENOTYPE_CONTENT_TYPES = new Set([
  "",
  "text/plain",
  "text/csv",
  "text/tab-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
]);

const GENOTYPE_HEADERS = [
  ["rsid", "chromosome", "position", "genotype"],
  ["rsid", "chromosome", "position", "result"],
];
const ALLELE_HEADER = ["rsid", "chromosome", "position", "allele1", "allele2"];

const splitCells = (line) => {
  const delimiter = line.includes("\t") ? "\t" : line.includes(",") ? "," : null;
  const parts = delimiter ? line.split(delimiter) : line.trim().split(/\s+/);
  return parts.map((p) => p.trim().replace(/^"+|"+$/g, "").trim().toLowerCase());
};

const startsWith = (cells, header) => header.every((name, i) => cells[i] === name);

/** "genotype" (one column), "alleles" (two), or null when not an export. */
export const sniffGenotypeHeader = (text) => {
  const head = String(text || "").slice(0, SNIFF_BYTES).replace(/^\uFEFF/, "");
  for (const raw of head.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = splitCells(line.replace(/^#+/, "").trim()).filter(Boolean);
    if (GENOTYPE_HEADERS.some((h) => startsWith(cells, h))) return "genotype";
    if (startsWith(cells, ALLELE_HEADER)) return "alleles";
    // The first real line was not a header: this file does not declare its columns.
    if (!line.startsWith("#")) return null;
  }
  return null;
};

export const mayBeGenotypeType = (mimeType) => GENOTYPE_CONTENT_TYPES.has(mimeType || "");
