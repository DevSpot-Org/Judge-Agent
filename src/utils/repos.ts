import { $ } from "bun";

export const isGithubRepo = (url: string) => {
  const parsedUrl = new URL(url);
  if (!parsedUrl.hostname.includes("github.com")) return false;

  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);

  // need url to be owner/repo => ['owner', 'repo']
  return pathSegments.length === 2;
};

export const repositoryExists = async (repoUrl: string) => {
  const request = await fetch(repoUrl);
  return request.status === 200;
};

export const repoContainsCode = async (repoUrl: string) => {
  const { stdout } = await $`git ls-remote --heads ${repoUrl}`
    .nothrow()
    .quiet();
  // checks the latest refs of a repo. Empty repos will have no stdout
  return stdout.length > 0;
};

export const getRepoName = (url: string) => {
  const parsedUrl = new URL(url);
  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  return pathSegments[pathSegments.length - 1];
};

export const folderExists = async (path: string) => {
  return !!Array.from(new Bun.Glob(path).scanSync({ onlyFiles: false }))[0];
};
