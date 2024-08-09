import express from "express";

const ExpressConfig = () => {
  const app = express();
  app.use(express.json());
  app.set("trust proxy", true);
  return app;
};

export default ExpressConfig;
