import { $ } from "bun";
import path from "path";
import { TEMPORARY_FOLDER } from "../constants";
import { excludePatterns } from "../constants/exclude-patterns";
import type { Project } from "../types/entities";
import { getRepoName } from "./repos";

/**
 * Processes a remote repository and generates a Repomix XML summary.
 * @param repoUrl - The URL of the remote repository.
 * @param outputDir - The directory to store the output file. Defaults to the current working directory.
 * @returns The path to the generated XML file.
 */
const repomixBundler = async (submission: Project) => {
  const { project_url: repoUrl } = submission;

  const repoName = getRepoName(repoUrl!);
  const repoPath = `${TEMPORARY_FOLDER}/repositories`;

  const outputFileName = `${repoName}-pack.xml`;
  const outputPath = path.join(repoPath, outputFileName);
  const ignoreGlobString = [...excludePatterns].join(",");

  try {
    await $`npx repomix --remote ${repoUrl} --output ${outputPath} --compress --ignore ${ignoreGlobString}`;

    return outputPath;
  } catch (error) {
    console.log(`Error while bundling with repomix: ${error}`);
  }
};

export default repomixBundler;
