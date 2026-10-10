import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { env } from "../env.ts";

const getGreeting = createServerFn({ method: "GET" }).handler(
  () => env.GREETING
);

function Home() {
  const greeting = Route.useLoaderData();
  return (
    <main>
      <h1>{greeting}</h1>
    </main>
  );
}

export const Route = createFileRoute("/")({
  component: Home,
  loader: () => getGreeting(),
});
