export const MAX_PROMPT_SIZE = 20971520; // 20MB in bytes

export const checkPromptSize = (prompt: string) => {
  const promptSize = new TextEncoder().encode(prompt).length;
  if (promptSize > MAX_PROMPT_SIZE) {
    throw new Error(
      `Prompt size (${promptSize} bytes) exceeds maximum allowed size (${MAX_PROMPT_SIZE} bytes)`
    );
  }
};
