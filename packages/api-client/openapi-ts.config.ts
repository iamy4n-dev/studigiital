import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "http://localhost:8000/openapi.json",
  output: {
    path: "src",
    format: "prettier",
  },
  plugins: ["@hey-api/client-fetch"],
});
