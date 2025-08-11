import * as esbuild from "https://deno.land/x/esbuild@v0.19.11/mod.js";

await esbuild.build({
    entryPoints: ["./main.ts"],
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    outfile: "./main.js",
    external: [
        "three",
        "three/*",
        "npm:three",
        "npm:three/*"
    ],
    alias: {
        "npm:three": "three",
        "npm:three/examples/jsm/controls/OrbitControls": "three/examples/jsm/controls/OrbitControls"
    }
});

console.log("Build complete!");
await esbuild.stop();
