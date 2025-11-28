import Fastify from "fastify";
import { connectDB } from "./config/db.js";
import locationRoutes from "./routes/location.routes.js";
import indexRoutes from "./routes/index.routes.js";
import paymentFunction from "./routes/payment.route.js";
import subscriberFunction from "./routes/subscribers.route.js";
import authFunction from "./routes/auth.route.js";

export const buildApp = async () => {
  const fastify = Fastify({ logger: true });

  // Connect Database
  await connectDB();

  // Register Routes
  fastify.register(indexRoutes,{prefix:"/"});
  fastify.register(locationRoutes,{prefix:"/api/location"});
  fastify.register(paymentFunction,{ prefix:"/api/payment"})
  fastify.register(subscriberFunction,{ prefix:"/api/subscribers"})
  fastify.register(authFunction,{ prefix:"/api/login"})

  return fastify;
};
