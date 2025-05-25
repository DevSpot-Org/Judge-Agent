// import { logParsedDataResults } from "./src/utils/logging";

import JudgeBot from "./src/agents/judgeAgent";

const main = async () => {
  const bot = new JudgeBot();
  bot.start(41);

  // const submissionData = await getSubmissionsData();
  // logParsedDataResults(submissionData);
  const failedSubmissions: string[] = [];

  // console.log("Starting to pull repositories...");
  // for (const submission of submissionData.validSubmissions) {
  //   await pullRepo(submission);
  // }

  // console.log("\nGenerating individual reports...");
  // for (const submission of submissionData.validSubmissions) {
  //   try {
  //     console.log(`\nProcessing report for: ${submission.name}`);
  //     await produceReport(submission, "gemini");
  //     console.log("Report generated successfully!");
  //   } catch (error) {
  //     console.error(`Failed to process report for ${submission.name}:`, error);
  //     failedSubmissions.push(submission.name);
  //   }
  // }

  // if (failedSubmissions.length > 0) {
  //   console.log("\n\nFailed to analyze the following submissions:");
  //   failedSubmissions.forEach((name) => console.log(`- ${name}`));
  //   console.log(`Total failed: ${failedSubmissions.length}`);
  // } else {
  //   console.log("\n\nAll submissions were analyzed successfully!");
  // }

  // // Comment out or remove the comparison report generation since we only have one report
  // console.log("\nGenerating final comparison report...");
  // try {
  //   await aggregateAllReports();
  //   console.log("\nFinal comparison report generated successfully!");
  // } catch (error) {
  //   console.error("Failed to generate comparison report:", error);
  // }
  // await findHighestScore();
};

main();

