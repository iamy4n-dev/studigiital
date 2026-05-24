import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "http://localhost:8000/openapi.json",
  output: {
    path: "src",
    format: "prettier",
  },
  client: "@hey-api/client-fetch",
});
