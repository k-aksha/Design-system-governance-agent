import { z } from "zod";

export const SeveritySchema = z.enum(["block", "warn", "info"]);

export const GovernanceProfileSchema = z.object({
  schema_version: z.number().optional(),
  defaults: z
    .object({
      source_of_truth: z
        .object({
          mode: z.enum(["figma", "code", "dual_compare"]).default("dual_compare"),
          on_conflict: z
            .enum(["flag_owner", "block", "code_wins", "figma_wins"])
            .default("flag_owner"),
          code: z.object({ ref: z.string().default("main") }).optional(),
          figma: z.object({ enabled: z.boolean().default(false) }).optional(),
        })
        .optional(),
    })
    .optional(),
  tokens: z
    .object({
      manifest: z.string().optional(),
      allow_raw_values: z.boolean().default(false),
      patterns: z
        .object({
          allowed_var_prefixes: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  severity_policy: z.record(SeveritySchema).optional(),
  flagging: z
    .object({
      github: z
        .object({
          fail_on: z.array(SeveritySchema).default(["block"]),
          annotate_lines: z.boolean().default(true),
        })
        .optional(),
      slack: z
        .object({
          enabled: z.boolean().default(false),
          webhook_env: z.string().default("SLACK_WEBHOOK_URL"),
          on: z.array(SeveritySchema).default(["block", "warn"]),
          mention_owner_on: z.array(SeveritySchema).default(["block"]),
        })
        .optional(),
      figma_comments: z
        .object({
          enabled: z.boolean().default(false),
          token_env: z.string().default("FIGMA_ACCESS_TOKEN"),
          on_severity: z.array(SeveritySchema).default(["block", "warn"]),
          on_categories: z.array(z.string()).optional(),
          threading: z.object({ mode: z.string().default("one_thread_per_run") }).optional(),
          target: z
            .object({
              prefer: z.string().optional(),
              fallback: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

export const ComponentRegistrySchema = z.object({
  schema_version: z.number().optional(),
  discovery: z
    .object({
      code_glob: z.string().optional(),
      auto_register: z.enum(["off", "suggest", "on"]).optional(),
    })
    .optional(),
  _default: z
    .object({
      kind: z.string().optional(),
      checks: z.union([z.string(), z.array(z.string())]).optional(),
      owners: z
        .object({
          slack_channel: z.string().optional(),
          github: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  components: z.record(
    z.object({
      kind: z.string().optional(),
      checks: z.union([z.string(), z.array(z.string())]).optional(),
      owners: z
        .object({
          slack_channel: z.string().optional(),
          github: z.string().optional(),
        })
        .optional(),
      designer_owners: z.array(z.string()).optional(),
      source_of_truth: z
        .object({
          mode: z.enum(["figma", "code", "dual_compare"]).optional(),
          code: z.object({ paths: z.array(z.string()).optional(), ref: z.string().optional() }).optional(),
          figma: z
            .object({
              file_key: z.string().optional(),
              component_set_node_id: z.string().optional(),
              branch_key: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
      code: z.object({ paths: z.array(z.string()) }).optional(),
      figma: z
        .object({
          file_key: z.string().optional(),
          component_set_node_id: z.string().optional(),
        })
        .optional(),
    })
  ),
  check_packs: z.record(z.array(z.string())).optional(),
});

export type GovernanceProfile = z.infer<typeof GovernanceProfileSchema>;
export type ComponentRegistry = z.infer<typeof ComponentRegistrySchema>;
export type Severity = z.infer<typeof SeveritySchema>;

export type GovernanceFinding = {
  id: string;
  component: string;
  severity: Severity;
  category: string;
  title: string;
  message: string;
  location?: { path: string; line?: number; column?: number };
  canonical?: { source: "figma" | "code" | "dual"; expected?: string; actual?: string };
  evidence?: Record<string, unknown>;
  fix?: { suggestion?: string };
  figma?: { file_key: string; node_id: string; post_comment?: boolean };
};

export type RunContext = {
  profile: GovernanceProfile;
  registry: ComponentRegistry;
  workspaceRoot: string;
  baseRef: string;
  headRef: string;
  baseDir?: string;
  headDir?: string;
  prUrl?: string;
  runId: string;
  figmaFileKey?: string;
  figmaBranchKey?: string;
  waiversPath?: string;
};

export type RunResult = {
  runId: string;
  components: string[];
  findings: GovernanceFinding[];
  verdict: "pass" | "fail" | "warn";
  comparedAgainst: { code?: string; figma?: string };
};
