import { Location } from "../models/location.model.js";

export default async function locationRoutes(fastify) {
    // Get all locations
    fastify.get("/", async (request, reply) => {
        try {
            const {
                search = "",       // for name or location search
                page = 1,
                limit = 10,
                sort_by = "createdAt",
                sort_order = "desc",
                baseUrl,           // optional filter
                location           // optional filter
            } = request.query;

            // 🧠 Build dynamic filter
            const filter = {};

            if (search) {
                filter.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { location: { $regex: search, $options: "i" } },
                    { baseUrl: { $regex: search, $options: "i" } }
                ];
            }

            if (baseUrl) filter.baseUrl = baseUrl;
            if (location) filter.location = location;

            // ⚙️ Sorting
            const sortOptions = { [sort_by]: sort_order === "asc" ? 1 : -1 };

            // 🔢 Pagination
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const total = await Location.countDocuments(filter);
            const locations = await Location.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit));

            return reply.code(200).send({
                status: true,
                message: "Locations fetched successfully",
                data: locations,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                status: false,
                message: "Failed to fetch locations",
                error: error.message
            });
        }
    });

    // Add location
    fastify.post("/", async (req, reply) => {
        try {
            const { name, location, amount } = req.body;

            const existingLocation = await Location.findOne({
                name: { $regex: name, $options: "i" },
                location: { $regex: location, $options: "i" },
            });
            if (existingLocation) {
                return reply.code(400).send({
                    status: false,
                    message: `School '${name}' already exists`
                });
            }
            const newLocation = new Location(req.body);
            await newLocation.save();
            reply.code(201).send(newLocation);
        } catch (error) {
            return reply(400).send({ statud: false, message: `Something went wrong (${error.message})` })
        }
    });

    // Update location
    fastify.put("/:id", async (req, reply) => {
        try {
            console.log("<><>working",req.body)
        const existingLocation = await Location.findOne({
            _id: { $ne: req.params.id },
            name: { $regex: req.body.name, $options: "i" },
            location: { $regex: req.body.location, $options: "i" },
        });
        if(existingLocation){
            return reply.code(400).send({status:false,message:`Already existing school name ${req.body.name} with the same location ${req.body.location}`})
        }
        const updated = await Location.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
        });
        reply.send({status:true,data:updated,message:"updated successfully"});
        } catch (error) {
            console.log("<><>error",error)
        }
    });

    // Delete location
    fastify.delete("/:id", async (req, reply) => {
        await Location.findByIdAndDelete(req.params.id);
        reply.send({ message: "Location deleted successfully" });
    });

    // Delete location
    fastify.get("/:id", async (req, reply) => {
        const locationData = await Location.findById(req.params.id);
        reply.code(200).send({ status: true, data: locationData, message: "Location deleted successfully" });
    });
}
