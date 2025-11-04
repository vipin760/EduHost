import Fastify from "fastify";
import { connectDB } from "./config/db.js";
import locationRoutes from "./routes/location.routes.js";
import indexRoutes from "./routes/index.routes.js";

export const buildApp = async () => {
  const fastify = Fastify({ logger: true });

  // Connect Database
  await connectDB();

  // Register Routes
  fastify.register(indexRoutes,{prefix:"/"});
  fastify.register(locationRoutes,{prefix:"/api/location"});

  return fastify;
};
