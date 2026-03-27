import { z } from "zod";

export const generatedSectionSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  sourceObjectIds: z.array(z.string()).default([])
});

export const generatedDocumentSchema = z.object({
  sections: z.array(generatedSectionSchema).min(1)
});

export type GeneratedDocumentJson = z.infer<typeof generatedDocumentSchema>;

