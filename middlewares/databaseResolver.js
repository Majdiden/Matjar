import { getConnectionForTenant } from "../utils/connectionManager.js";
import { verifyJWT } from "../utils/misc.js";

export const databaseResolver = async (req, _, next) => {
  const urlArr = req.url.split("/");

  // Skip database resolution for login route
  if (urlArr.includes("login")) return next();
  if (urlArr.includes("add")) return next();

  const token = req.headers.jwt;
  // Handle the logic for null checking and authorization
  const payloadData = verifyJWT(token);
  // Handle the expiry logic, etc.
  const dbConnection = getConnectionForTenant(payloadData.tenantId);

  // Here, we are directly populating the req object, but you can use
  // custom context managers in your application
  req.dbConnection = dbConnection;
  next();
};
