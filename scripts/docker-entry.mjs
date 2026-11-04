// Container entry: start the optional Ervisio plugin socket, then the Next server.
import { startPluginSocket } from "./plugin-socket.mjs";
try {
  await startPluginSocket();
} catch (error) {
  console.error("Plugin socket disabled:", error.message);
  delete process.env.PLUGIN_SECRET;
}
await import("./server.js");
