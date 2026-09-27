const EXTENSIONS = /\.(txt|csv|vcf|vcf\.gz|txt\.gz|csv\.gz|zip|gz)$/i;

export const isGenotypeUpload = (file) =>
  file instanceof File && file.size > 0 && EXTENSIONS.test(file.name);

export const activeSetFromResponse = (response) => {
  if (!response || typeof response !== "object" || !("active_set" in response)) {
    throw new Error("Invalid genotype summary response");
  }
  const set = response.active_set;
  if (set === null) return null;
  if (!set || set.status !== "active" || !Number.isInteger(set.n_rows) ||
      !Number.isInteger(set.n_called) || set.n_rows <= 0 ||
      set.n_called < 0 || set.n_called > set.n_rows) {
    throw new Error("Invalid active genotype set");
  }
  return set;
};

export const callRate = (set) => Math.round((set.n_called / set.n_rows) * 1000) / 10;

export const geneticUploadEvent = (event, messageId) => {
  if (!messageId || event?.messageId !== messageId) return null;
  if (event.type === "upload_error" ||
      (event.type === "upload_completed" && event.status === "failed")) {
    return { phase: "failed", progress: 0 };
  }
  if (event.type === "upload_completed" && event.genetic_processing_final === true &&
      event.status === "completed") {
    return { phase: "complete", progress: 100 };
  }
  if (event.type === "upload_progress" || event.type === "file_progress" ||
      event.type === "file_received") {
    return {
      phase: "processing",
      progress: Math.min(99, Math.max(0, Number(event.progress) || 0)),
    };
  }
  return null;
};
