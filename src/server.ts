import cors from "cors";
import type { Request, Response } from "express";
import express from "express";
import JudgeBot from "./agents";

const app = express();
const port = 3000;

app.use(express.json());

app.use(cors());

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

    await judgeBot.start(projectId);

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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

export default app;
