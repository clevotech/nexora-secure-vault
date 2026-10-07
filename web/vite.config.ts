import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";

const nobleCiphers = fileURLToPath(new URL("./node_modules/@noble/ciphers/", import.meta.url));
const nobleHashes = fileURLToPath(new URL("./node_modules/@noble/hashes/", import.meta.url));

export default defineConfig({
  plugins:[react()],
  resolve:{
    preserveSymlinks:true,
    alias:{
      "@noble/ciphers": nobleCiphers,
      "@noble/hashes": nobleHashes
    }
  },
  server:{port:5173,fs:{allow:[".."]}},
  optimizeDeps:{exclude:["@nexora/secure-core"]}
});
