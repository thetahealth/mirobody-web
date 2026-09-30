import { describe, expect, it, vi } from "vitest";
import { GENOTYPE_ACCEPT, activeSetFromResponse, callRate, geneticUploadEvent, isGenotypeUpload } from "./model";

describe("genomics upload", () => {
  it("accepts public export containers and rejects unrelated files", () => {
    vi.stubGlobal("File", class { constructor(name, size) { this.name = name; this.size = size; } });
    for (const name of ["sample.txt", "sample.csv", "sample.vcf", "sample.vcf.gz", "sample.txt.gz", "sample.csv.gz", "sample.vcf.bgz", "sample.vcf.bgzf", "sample.zip"]) {
      expect(isGenotypeUpload(new File(name, 500))).toBe(true);
    }
    expect(GENOTYPE_ACCEPT).toContain(".vcf.bgz");
    expect(GENOTYPE_ACCEPT).toContain(".vcf.bgzf");
    expect(isGenotypeUpload(new File("sample.pdf", 500))).toBe(false);
    expect(isGenotypeUpload(new File("empty.vcf", 0))).toBe(false);
    vi.unstubAllGlobals();
  });

  it("does not mistake file receipt for activation", () => {
    const id = "public-test-upload";
    expect(geneticUploadEvent({ type: "upload_completed", messageId: id, status: "completed" }, id)).toBeNull();
    expect(geneticUploadEvent({ type: "upload_completed", messageId: "another", genetic_processing_final: true, status: "completed" }, id)).toBeNull();
    expect(geneticUploadEvent({ type: "upload_progress", messageId: id, progress: 50 }, id)).toEqual({ phase: "processing", progress: 50 });
    expect(geneticUploadEvent({ type: "upload_completed", messageId: id, genetic_processing_final: true, status: "completed" }, id)).toEqual({ phase: "complete", progress: 100 });
    expect(geneticUploadEvent({ type: "upload_error", messageId: id }, id)).toEqual({ phase: "failed", progress: 0 });
  });

  it("requires an active set and computes call rate from counts", () => {
    expect(activeSetFromResponse({ active_set: null })).toBeNull();
    const set = { status: "active", n_rows: 1000, n_called: 947 };
    expect(activeSetFromResponse({ active_set: set })).toBe(set);
    expect(callRate(set)).toBe(94.7);
    expect(() => activeSetFromResponse({ active_set: { ...set, status: "loading" } })).toThrow();
    expect(() => activeSetFromResponse({ rows: [] })).toThrow();
  });
});

describe("genomics source name", () => {
  it("names the vendor, or the file's shape instead of an internal id", async () => {
    const { sourceName } = await import("./model");
    expect(sourceName({ vendor: "23andMe", format_id: "23andme_txt" })).toEqual({ vendor: "23andMe" });
    expect(sourceName({ vendor: null, format_id: "generic_vcf" })).toEqual({ shape: "VCF" });
    expect(sourceName({ format_id: "generic_" })).toEqual({ vendor: "generic_" });
    expect(sourceName({ format_id: "" })).toBeNull();
    expect(sourceName(null)).toBeNull();
  });
});
