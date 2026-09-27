import adapter from "@sveltejs/adapter-node";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({ out: "build" }),
    csrf: {
      trustedOrigins: ["*"],
    },
    files: {
      routes: "src/routes",
      lib: "src/lib",
      appTemplate: "src/app.html",
      assets: "public",
    },
  },
};

export default config;
