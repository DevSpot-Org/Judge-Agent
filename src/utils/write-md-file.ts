/**
 * Saves content to a markdown file
 * @param content The string content to save
 * @param filename The name of the file (without .md extension)
 * @returns Promise<void>
 */
export async function saveToMarkdown(
  content: string,
  filename: string
): Promise<void> {
  try {
    const filePath = `${filename}.md`;
    await Bun.write(filePath, content);
  } catch (error) {
    console.error(`Error saving markdown file: ${error}`);
    throw error;
  }
}
