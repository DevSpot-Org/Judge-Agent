import cors from "cors";
import type { Request, Response } from "express";
import express from "express";
import JudgeBot from "./agents";

const app = express();
const port = 3000;

app.use(express.json());

app.use(cors({
  origin: "*",
}));

app.use(express.static("public"));

app.use(express.urlencoded({ extended: false }));

app.get("/self", (_, res) => {
  console.log("Self route called");
  res.send("Self call succeeded!");
  return;
});

app.post("/judge/:project_id", async (req: Request, res: Response) => {
  const projectIdString = req.params["project_id"];

  if (!projectIdString) {
    res.status(400).send({ error: "Project ID is required" });
  }

  const projectId = parseInt(projectIdString, 10);
  if (isNaN(projectId)) {
    res.status(400).send({ error: "Project ID must be a number" });
  }

  try {
    const judgeBot = new JudgeBot();

    await judgeBot.judge_project(projectId);

    res.status(200).send({
      message: `Judging process started for project ID: ${projectId}`,
    });

    return;
  } catch (error) {
    console.error(`Error judging project ID ${projectId}:`, error);

    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";

    res.status(500).send({ error: `Failed to judge project: ${errorMessage}` });
  }

  return;
});

app.get("/project/generate", async (req: Request, res: Response) => {
  const projectUrl = req.query["project_url"] as string;

  if (!projectUrl) {
    res.status(400).send({ error: "Project URL is required" });
    return;
  }
  try {
    const judgeBot = new JudgeBot();

    const response = await judgeBot.create_submit_generation_flow(projectUrl);

    res.status(200).send({ data: response });

    return;
  } catch (error) {
    console.error(
      `Error Generating Project Information for ${projectUrl}:`,
      error
    );

    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";

    res
      .status(500)
      .send({ error: `Failed to generate project: ${errorMessage}` });
  }

  return;
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

app.listen(port, async () => {
  console.log(`Server running on port ${port}`);

  // Schedule periodic self-calls every 30 minutes to avoid render server shutting down
  setInterval(async () => {
    try {
      console.log("Calling /self endpoint...");
      fetch(`${process.env["ORIGIN_URL"]}/self`);
    } catch (error: any) {
      console.error("Self call failed:", error.message);
    }
  }, 14 * 60 * 1000); // 30 minutes in milliseconds
});

export default app;
