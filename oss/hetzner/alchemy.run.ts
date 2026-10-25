import * as Hetzner from "@alchemy.run/hetzner";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";

import Api from "./src/api";
import { Box } from "./src/server";

export default Alchemy.Stack(
  "hetzner",
  {
    providers: Hetzner.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const server = yield* Box;
    const api = yield* Api;

    return {
      ipv4: server.ipv4,
      url: api.url,
    };
  })
);
