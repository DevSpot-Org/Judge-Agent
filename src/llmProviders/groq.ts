export const groqFetch = async (
  userPrompt: string,
  model: string = "deepseek-r1-distill-llama-70b"
) => {
  try {
    const apiKey = process.env["GROQ_API_KEY"];

    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not defined in process.env");
    }

    const requestBody: any = {
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      model,
      temperature: 0.6,
      max_tokens: 2048,
      top_p: 0.95,
      stream: false,
    };

    // Only add reasoning_format for deepseek models
    if (model.includes("deepseek")) {
      requestBody.reasoning_format = "parsed";
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const test = await response.json();
      console.log(test);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Groq API Error:", error);
    throw error;
  }
};
