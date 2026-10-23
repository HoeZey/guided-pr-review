import { z } from "zod";

export const ConnectionStatus = z.enum([
  "connected",
  "command-missing",
  "login-required",
  "expired",
  "denied-scope",
  "timeout",
  "malformed",
]);

export const ConnectionProvider = z.enum(["azure-devops", "github"]);

export const ConnectionView = z
  .object({
    provider: ConnectionProvider,
    host: z.string().min(1),
    status: ConnectionStatus,
    login: z.string().min(1).optional(),
    recovery: z.string().min(1).optional(),
  })
  .strict();

export const ConnectionList = z
  .object({
    connections: z.array(ConnectionView),
  })
  .strict();

export type ConnectionStatus = z.infer<typeof ConnectionStatus>;
export type ConnectionProvider = z.infer<typeof ConnectionProvider>;
export type ConnectionView = z.infer<typeof ConnectionView>;
export type ConnectionList = z.infer<typeof ConnectionList>;
