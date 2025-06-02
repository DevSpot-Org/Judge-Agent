import { $ } from "bun";
import path from "path";
import { TEMPORARY_FOLDER } from "../constants";
import { excludePatterns } from "../constants/exclude-patterns";
import { includePatterns } from "../constants/include-patterns";
import { getRepoName } from "./repos";

/**
 * Processes a remote repository and generates a Repomix XML summary.
 * @param repoUrl - The URL of the remote repository.
 * @param outputDir - The directory to store the output file. Defaults to the current working directory.
 * @returns The path to the generated XML file.
 */
const repomixBundler = async (repoUrl: string) => {
  const repoName = getRepoName(repoUrl!);
  const repoPath = `${TEMPORARY_FOLDER}/repositories`;

  const outputFileName = `${repoName}-pack.xml`;
  const outputPath = path.join(repoPath, outputFileName);
  const ignoreGlobString = [...excludePatterns].join(",");
  const includeGlobString: string[] = Array.from(includePatterns).map((entry) =>
    /^[a-z0-9]+$/i.test(entry) ? `**/*.${entry}` : `**/${entry}`
  );

  try {
    await $`npx repomix --remote ${repoUrl} --output ${outputPath} --compress --remove-comments --remove-empty-lines  --include "**/*.rs,**/*.js,**/*.ts,**/*.tsx,**/*.jsx,**/*.py,**/*.java,**/*.c,**/*.cpp,**/*.h,**/*.hpp,**/*.go,**/*.rb,**/*.php,**/*.swift,**/*.kt,**/*.kts,**/*.scala,**/*.groovy,**/*.pl,**/*.pm,**/*.lua,**/*.r,**/*.m,**/*.cs,**/*.fs,**/*.vb,**/*.dart,**/*.html,**/*.css,**/*.scss,**/*.sass,**/*.less,**/*.svelte,**/*.vue,**/*.svg,**/*.woff,**/*.woff2,**/*.eot,**/*.ttf,**/*.otf,**/*.sh,**/*.bash,**/*.zsh,**/*.fish,**/*.ps1,**/*.yaml,**/*.yml,**/*.json,**/*.toml,**/*.xml,**/*.csv,**/*.tsv,**/*.cfg,**/*.conf,**/*.ini,**/*.env,**/*.properties,**/*.dockerfile,**/*.Makefile,**/*.makefile,**/CMakeLists.txt,**/*.gradle,**/*.gradlew,**/pom.xml,**/*.Jenkinsfile,**/*.gitignore,**/*.gitattributes,**/*.gitmodules,**/*.lock,**/*.sum,**/*.md,**/*.markdown,**/*.txt,**/*.rst,**/*.tex,**/*.hbs,**/*.handlebars,**/*.ejs,**/*.pug,**/*.mustache,**/*.j2,**/*.jinja2,**/*.sql" --ignore ${ignoreGlobString} --quiet`;

    return outputPath;
  } catch (error) {
    console.log(`Error while bundling with repomix: ${error}`);
  }
};

export default repomixBundler;
