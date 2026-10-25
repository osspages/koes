import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";

import { Website } from "./src/website.ts";

export default Alchemy.Stack(
  "koes",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state({ name: "koes" }),
  },
  Effect.gen(function* () {
    const website = yield* Website;

    return {
      websiteUrl: website.url.as<string>(),
    };
  })
);
