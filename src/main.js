/* Hotel Rush entry point: load the lobby, start the game loop, register the offline cache */
import { World } from "./world.js";
import { Game } from "./game.js";

const world = new World(document.getElementById("scene"), document.getElementById("labels"));
const bar = document.getElementById("loadBar"), text = document.getElementById("loadText");
try {
  await world.load(p => { bar.style.width = Math.round(p * 100) + "%"; });
} catch (e) {
  text.textContent = "Не удалось загрузить отель. Проверь интернет и открой ещё раз.";
  throw e;
}
const game = new Game(world);
document.getElementById("loading").remove();
world.resize();

function loop() {
  const paused = !!(game.g && (game.g.paused || game.g.over || game.question));
  const dt = world.frame(paused);
  if (game.g && !paused) { game.tick(dt); game.runTimers(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
new ResizeObserver(() => world.resize()).observe(document.getElementById("stage"));

if ("serviceWorker" in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had && !game.g) location.reload(); });
}
window.__hotel = { world, game };
