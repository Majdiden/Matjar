import router from "../routes/index.js";

export default function (app) {
  app.use("/api", router);
}
