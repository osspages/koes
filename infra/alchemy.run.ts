import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

import { Website } from "./src/website.ts";

export default Alchemy.Stack(
  "koes",
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const website = yield* Website;

    return {
      websiteUrl: website.url.as<string>(),
    };
  })
);
