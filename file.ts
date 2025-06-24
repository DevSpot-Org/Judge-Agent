import { fetchHackathonFromDB, getProjectInformation } from './src/core/devspot';
import { analyzeProjectForIrregularities } from './src/judge_project/utils/flag-logic';

const main = async (projectid: number) => {
    const project = await getProjectInformation(projectid);
    const hackathon = await fetchHackathonFromDB(1);

    const flaggedAnalysis = await analyzeProjectForIrregularities(project?.project_url ?? '', project?.hackathon!);

    console.log({ flaggedAnalysis });
};

main(344);
