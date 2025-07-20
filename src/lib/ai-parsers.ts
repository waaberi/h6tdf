/**
 * This file contains utility functions for parsing and cleaning AI model outputs.
 * It's designed to be robust against common formatting inconsistencies from LLMs.
 */

/**
 * Extracts a JSON object or array from a string, even if it's embedded in markdown,
 * surrounded by other text, or contains minor formatting issues.
 * 
 * The function tries two strategies:
 * 1. Look for a JSON object/array inside a markdown code block (e.g., ```json ... ```).
 * 2. If not found, look for the first '{' or '[' and the last '}' or ']' to extract a potential JSON object.
 * 
 * @param rawOutput The raw string output from the AI model.
 * @returns A cleaned string that should be valid for JSON.parse().
 * @throws {Error} If no plausible JSON object can be found in the string.
 */
export function extractJson(rawOutput: string): string {
  // Strategy 1: Look for a JSON object within a markdown code block.
  // This regex handles "```json", "```", and other text before/after the block.
  // It captures the content between the fences.
  const markdownJsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = rawOutput.match(markdownJsonRegex);

  if (match && match[1]) {
    // If a markdown block is found, return its content.
    return match[1].trim();
  }

  // Strategy 2: If no markdown block is found, find the first '{' or '[' and the last '}' or ']'.
  // This is a more general approach for when the AI forgets the markdown fences.
  const firstBracket = rawOutput.indexOf('[');
  const lastBracket = rawOutput.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return rawOutput.substring(firstBracket, lastBracket + 1).trim();
  }
  
  const firstBrace = rawOutput.indexOf('{');
  const lastBrace = rawOutput.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return rawOutput.substring(firstBrace, lastBrace + 1).trim();
  }

  // If neither strategy works, return the original string for the caller to handle.
  // This is safer than throwing an error here, as the caller has more context.
  return rawOutput;
}
