import { httpRouter } from "convex/server";
import { start } from "./workerBoot";
const http = httpRouter();
http.route({ path: "/research-worker/start", method: "POST", handler: start });
export default http;
