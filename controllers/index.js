import { loginService } from "../services/auth.js";
import { addATenantService } from "../services/tenant.js";
import { getAdminConnection } from "../utils/connectionManager.js";

export const loginController = async (req, res) => {
  const serviceFnResponse = await loginService(req.body);

  res.status(serviceFnResponse.code).json({ ...serviceFnResponse });
};

export const addATenantController = async (req, res) => {
  const adminConnection = await getAdminConnection();
  const serviceFnResponse = await addATenantService(adminConnection, req.body);
  console.log(serviceFnResponse);

  res.status(serviceFnResponse.statusCode).json({ ...serviceFnResponse });
};
