export type RedactionResult = {
  text: string;
  redactedFields: string[];
};

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[-\s]?)?(?:\d{2,4}[-\s]?){2,4}\d{2,4}/g;
const SALARY_REGEX = /\b(?:NT\$|USD\$|\$)\s?\d{2,3}(?:,\d{3})*(?:\.\d+)?\b/gi;

export function redactPII(input: string): RedactionResult {
  let text = input;
  const redactedFields: string[] = [];

  if (EMAIL_REGEX.test(text)) {
    text = text.replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
    redactedFields.push("email");
  }
  EMAIL_REGEX.lastIndex = 0;

  if (PHONE_REGEX.test(text)) {
    text = text.replace(PHONE_REGEX, "[REDACTED_PHONE]");
    redactedFields.push("phone");
  }
  PHONE_REGEX.lastIndex = 0;

  if (SALARY_REGEX.test(text)) {
    text = text.replace(SALARY_REGEX, "[REDACTED_AMOUNT]");
    redactedFields.push("salary_or_amount");
  }
  SALARY_REGEX.lastIndex = 0;

  return { text, redactedFields };
}

