export function parseProviderJsonObject(value: string) {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  let originalError: unknown;
  try {
    return assertObject(JSON.parse(cleaned));
  } catch (error) {
    originalError = error;
    // A syntactically valid non-object response is never recoverable by
    // extracting one of its nested objects.
    try {
      const parsed = JSON.parse(cleaned);
      return assertObject(parsed);
    } catch (shapeOrSyntaxError) {
      if (!(shapeOrSyntaxError instanceof SyntaxError)) throw shapeOrSyntaxError;
      originalError = shapeOrSyntaxError;
    }

    if (cleaned.startsWith("[")) throw originalError;
    const start = cleaned.indexOf("{");
    if (start < 0) throw originalError;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < cleaned.length; index += 1) {
      const character = cleaned[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          return assertObject(JSON.parse(cleaned.slice(start, index + 1)));
        }
      }
    }

    // A genuinely truncated object must still enter the existing repair/failure path.
    throw originalError;
  }
}

function assertObject(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("The LLM returned an invalid structured result");
  }
  return value as Record<string, unknown>;
}
