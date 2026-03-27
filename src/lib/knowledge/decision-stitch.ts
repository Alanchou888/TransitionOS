export type DecisionStitchMeta = {
  issueRefs: string[];
  commitRefs: string[];
  fileRefs: string[];
};

const ISSUE_REF_REGEX = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const GITHUB_ISSUE_REGEX = /#(\d{1,7})\b/g;
const COMMIT_SHA_REGEX = /\b[0-9a-f]{7,40}\b/gi;
const FILE_REF_REGEX = /\b[a-zA-Z0-9_\-/]+\.(ts|tsx|js|jsx|py|go|java|cs|md|sql|yml|yaml)\b/g;

export function extractDecisionStitchMeta(text: string): DecisionStitchMeta {
  const issueRefs = new Set<string>();
  const commitRefs = new Set<string>();
  const fileRefs = new Set<string>();

  for (const match of text.matchAll(ISSUE_REF_REGEX)) {
    issueRefs.add(match[0]);
  }
  for (const match of text.matchAll(GITHUB_ISSUE_REGEX)) {
    issueRefs.add(`#${match[1]}`);
  }
  for (const match of text.matchAll(COMMIT_SHA_REGEX)) {
    commitRefs.add(match[0]);
  }
  for (const match of text.matchAll(FILE_REF_REGEX)) {
    fileRefs.add(match[0]);
  }

  return {
    issueRefs: [...issueRefs],
    commitRefs: [...commitRefs],
    fileRefs: [...fileRefs]
  };
}

