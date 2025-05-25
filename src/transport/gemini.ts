export const geminiFetch = async (
  userPrompt: string,
  model: string = "gemini-2.0-flash-thinking-exp-01-21"
) => {
  try {
    const apiKey = process.env["GOOGLE_API_KEY"];

    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY is not defined in process.env");
    }

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: userPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.6,
        topK: 40,
        topP: 0.95,
        responseMimeType: "text/plain",
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.log(errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
