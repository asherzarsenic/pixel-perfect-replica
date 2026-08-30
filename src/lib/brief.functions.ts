import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runBriefAnalysis } from "./brief.server";

const inputSchema = z.object({
  brief: z.string().min(1).max(40000),
  context: z
    .object({
      projectType: z.string().optional(),
      clientName: z.string().optional(),
      deadline: z.string().optional(),
      budget: z.string().optional(),
      audience: z.string().optional(),
      deliverables: z.string().optional(),
      platform: z.string().optional(),
      brandGuidelines: z.string().optional(),
    })
    .optional(),
});

export const analyzeBrief = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => runBriefAnalysis(data.brief, data.context ?? {}));
