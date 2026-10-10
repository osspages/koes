import * as Cloudflare from "alchemy/Cloudflare";

import { Bucket } from "./bucket.ts";

export class Website extends Cloudflare.Website.Vite<Website>()("website", {
  env: {
    BUCKET: Bucket,
    GREETING: "Hello from koes!",
  },
  rootDir: "../apps/web",
}) {}

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;
