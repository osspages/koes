import * as Hetzner from "alchemy/Hetzner";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import { Box } from "./server.ts";

export default class Api extends Hetzner.Service<Api>()(
  "Api",
  { server: Box, main: import.meta.url, port: 3000 },

  // oxlint-disable-next-line require-yield
  Effect.gen(function* () {
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        const url = new URL(request.url, "http://service");
        if (url.pathname === "/health") {
          return yield* HttpServerResponse.json({ ok: true });
        }
        return HttpServerResponse.text("Hello from Hetzner!");
      }),
    };
  })
) {}
