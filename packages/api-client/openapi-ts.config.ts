import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./openapi.json",
  output: {
    path: "src",
    format: "prettier",
  },
  client: "legacy/fetch",
});
