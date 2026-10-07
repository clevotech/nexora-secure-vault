import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath, URL} from "node:url";

const webNodeModules = new URL("./node_modules/", import.meta.url);

export default defineConfig({
  plugins:[react()],
  resolve:{
    preserveSymlinks:true,
    alias:{
      "@noble/ciphers": fileURLToPath(new URL("@noble/ciphers/", webNodeModules)),
      "@noble/hashes": fileURLToPath(new URL("@noble/hashes/", webNodeModules))
    }
  },
  server:{port:5173,fs:{allow:[".."]}},
  optimizeDeps:{exclude:["@nexora/secure-core"]}
});
