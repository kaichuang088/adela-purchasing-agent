export function submissionKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,"0")).join("");
}

export const newSubmissionKey = submissionKey;
