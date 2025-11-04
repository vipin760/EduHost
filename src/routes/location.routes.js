import { Location } from "../models/location.model.js";

export default async function locationRoutes(fastify) {
  // Get all locations
  fastify.get("/", async () => {
    return await Location.find();
  });

  // Add location
  fastify.post("/", async (req, reply) => {
    const newLocation = new Location(req.body);
    await newLocation.save();
    reply.code(201).send(newLocation);
  });

  // Update location
  fastify.put("/:id", async (req, reply) => {
    const updated = await Location.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    reply.send(updated);
  });

  // Delete location
  fastify.delete("/:id", async (req, reply) => {
    await Location.findByIdAndDelete(req.params.id);
    reply.send({ message: "Location deleted successfully" });
  });
}
