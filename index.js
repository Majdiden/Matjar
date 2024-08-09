import ExpressConfig from "./server/express.config.js";
import MiddlewareConfig from "./server/middleware.config.js";
import RouteConfig from "./server/route.config.js";
import "dotenv/config";
import { connectAllDb } from "./utils/connectionManager.js";

const app = ExpressConfig();
MiddlewareConfig(app);
RouteConfig(app);
connectAllDb();
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port: ${PORT}`);
});
