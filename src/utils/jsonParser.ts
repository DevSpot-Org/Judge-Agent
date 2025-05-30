const jsonParser = (input: string): Record<string, any> | null => {
  if (!input) {
    return null;
  }

  try {
    let cleanedAnalysis = input.trim();

    // Remove markdown code blocks if present
    cleanedAnalysis = cleanedAnalysis
      .replace(/```json\s*/, "")
      .replace(/```\s*$/, "");

    // Find JSON object in the response
    const jsonMatch = cleanedAnalysis.match(/\{[\s\S]*\}/);

    const parsedResult = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : JSON.parse(cleanedAnalysis);

    return parsedResult;
  } catch (parseError) {
    // Log error details for debugging
    console.error(
      "JSON parsing error:",
      parseError instanceof Error ? parseError.message : "Unknown error"
    );
    console.error("Failed input:", input);

    return null;
  }
};

export default jsonParser;
