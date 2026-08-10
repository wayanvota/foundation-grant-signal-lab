// Kept temporarily so older deployment references fail closed instead of persisting reviews.
export const storagePolicy = Object.freeze({ mode: "stateless", persistsApplicantData: false });

export function assertStateless() {
  return storagePolicy;
}
