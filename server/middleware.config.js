import { databaseResolver } from "../middlewares/databaseResolver.js";

export default function (app) {
  app.use(databaseResolver);
}
