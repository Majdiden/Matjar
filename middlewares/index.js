import cookieParser from "cookie-parser";
import cors from "cors";

export default function (app) {
  app.use(cookieParser());
}
