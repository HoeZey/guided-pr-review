import adapter from "@sveltejs/adapter-node";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({ out: "build" }),
    files: {
      routes: "src/routes",
      lib: "src/lib",
      appTemplate: "src/app.html",
    },
  },
};

export default config;
