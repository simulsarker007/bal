import { defineConfig } from "cypress";
import { reseedDatabase, SeedData } from "./src/test/seed";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",

    setupNodeEvents(on) {
      on("task", {
        // Re-seed the database (delete all data & insert fresh)
        async reseed(data?: SeedData) {
          await reseedDatabase(data);
          return null;
        },
      });
    },
  },
});
