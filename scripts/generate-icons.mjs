import fs from "node:fs/promises";
import sharp from "sharp";

const source = await fs.readFile("public/icon-source.svg");

await sharp(source).resize(192, 192).png().toFile("public/pwa-192.png");
await sharp(source).resize(512, 512).png().toFile("public/pwa-512.png");
await sharp(source).resize(512, 512).extend({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  background: "#0d0d12",
}).png().toFile("public/maskable-512.png");

console.log("Generated PWA icons.");
