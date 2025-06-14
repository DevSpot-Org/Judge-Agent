import axios from "axios";

export const openaiFetch = async (userPrompt: string, model: string = "o3") => {
  try {
    const apiKey = process.env["OPENAI_API_KEY"];

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
      max_completion_tokens: 2048,
      stream: false,
    };

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    return response?.data.choices[0].message.content;
  } catch (error) {
    // console.error("OpenAI API Error:", error);
    throw error;
  }
};
