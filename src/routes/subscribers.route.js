import parentsubscriptionModel from "../models/parentsubscription.model.js";
import { Location } from "../models/location.model.js";
import authenticateToken from "../middleware/auth.middleware.js";
import mongoose from "mongoose";

export default async function subscriberFunction(fastify) {

    // ============================================================
    // 1️⃣ LOCATIONS + STATS
    // ============================================================
    fastify.get("/locations/stats", { preHandler: authenticateToken }, async (req, reply) => {
        try {
            const today = new Date();

            // Query params
            let {
                page = 1,
                limit = 10,
                search = "",
                sortField = "name",
                sortOrder = "asc"
            } = req.query;

            page = parseInt(page);
            limit = parseInt(limit);
            const skip = (page - 1) * limit;
            sortOrder = sortOrder === "asc" ? 1 : -1;

            // Filter for search by name or location
            const matchStage = {};
            if (search) {
                matchStage.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { location: { $regex: search, $options: "i" } }
                ];
            }

            const stats = await Location.aggregate([
                { $match: matchStage },

                {
                    $lookup: {
                        from: "parentsubscriptions",
                        let: { locationId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ["$location_id", { $toString: "$$locationId" }]
                                    }
                                }
                            },
                            { $sort: { start_date: -1 } },
                            {
                                $group: {
                                    _id: "$student_id",
                                    latestSub: { $first: "$$ROOT" }
                                }
                            }
                        ],
                        as: "subscriber_details"
                    }
                },
                {
                    $addFields: {
                        location_id: "$_id", // add explicit location_id
                        total_subscribers: { $size: "$subscriber_details" },
                        active_subscribers: {
                            $size: {
                                $filter: {
                                    input: "$subscriber_details",
                                    as: "s",
                                    cond: {
                                        $and: [
                                            { $eq: ["$$s.latestSub.payment_status", "SUCCESS"] },
                                            { $eq: ["$$s.latestSub.is_active", true] },
                                            { $gte: ["$$s.latestSub.expire_date", today] }
                                        ]
                                    }
                                }
                            }
                        },
                        expired_subscribers: {
                            $size: {
                                $filter: {
                                    input: "$subscriber_details",
                                    as: "s",
                                    cond: {
                                        $and: [
                                            { $eq: ["$$s.latestSub.payment_status", "SUCCESS"] },
                                            { $lt: ["$$s.latestSub.expire_date", today] }
                                        ]
                                    }
                                }
                            }
                        },
                        total_revenue: {
                            $sum: {
                                $map: {
                                    input: "$subscriber_details",
                                    as: "s",
                                    in: {
                                        $cond: [
                                            { $eq: ["$$s.latestSub.payment_status", "SUCCESS"] },
                                            { $toDouble: "$$s.latestSub.amount" },
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    }
                },
                // Remove subscriber_details from final output
                { $project: { subscriber_details: 0 } },
                // Sorting
                { $sort: { [sortField]: sortOrder } },
                // Pagination
                { $skip: skip },
                { $limit: limit }
            ]);

            const totalCount = await Location.countDocuments(matchStage);

            return reply.code(200).send({
                success: true,
                data: stats,
                pagination: {
                    total: totalCount,
                    page,
                    limit,
                    pages: Math.ceil(totalCount / limit)
                }
            });
        } catch (err) {
            console.error(err);
            return reply
                .code(500)
                .send({ success: false, message: "Internal Server Error", error: err.message });
        }
    });

    // ============================================================
    // 2️⃣ SUBSCRIBERS BY LOCATION
    // ============================================================
    fastify.get(
        "/location/:locationId",
        { preHandler: authenticateToken },
        async (request, reply) => {
            try {
                const { locationId } = request.params;
                const { page = 1, limit = 10, search = "", sortBy = "start_date", sortOrder = "desc" } = request.query;

                const skip = (parseInt(page) - 1) * parseInt(limit);
                const today = new Date();

                // Build search filter
                const matchFilter = {
                    location_id: locationId, // keep as string to match stored data
                    payment_status: "SUCCESS",
                    is_active:true,
                    expire_date: { $gte: today },
                };

                if (search) {
                    matchFilter.student_id = { $regex: search, $options: "i" }; // simple search by student_id, can be expanded
                }

                // Count total subscribers
                const total = await parentsubscriptionModel.countDocuments(matchFilter);

                // Fetch paginated subscribers
                const subscribers = await parentsubscriptionModel.aggregate([
                    { $match: { location_id: locationId, payment_status: "SUCCESS" } },
                    { $sort: { start_date: -1 } },
                    {
                        $group: {
                            _id: "$student_id",
                            latestSub: { $first: "$$ROOT" }
                        }
                    },
                    { $replaceRoot: { newRoot: "$latestSub" } },
                    { $match: { expire_date: { $gte: today } } }, // filter expired
                    { $skip: skip },
                    { $limit: parseInt(limit) },
                    {
                        $lookup: {
                            from: "locations",
                            let: { locId: "$location_id" },
                            pipeline: [
                                { $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$locId"] } } },
                                { $project: { name: 1, baseUrl: 1, location: 1 } }
                            ],
                            as: "location"
                        }
                    },
                    { $unwind: "$location" },
                ]);


                const pages = Math.ceil(total / parseInt(limit));

                return reply.code(200).send({
                    success: true,
                    count: subscribers.length,
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages,
                    data: subscribers
                });

            } catch (error) {
                console.error(error);
                return reply.code(500).send({
                    success: false,
                    message: "Internal Server Error",
                    error: error.message
                });
            }
        }
    );


    // ============================================================
    // 3️⃣ SUBSCRIPTION HISTORY BY STUDENT
    // ============================================================
    fastify.get(
        "/:studentId/history",
        { preHandler: authenticateToken },
        async (request, reply) => {
            try {
                const { studentId } = request.params;
                const {
                    page = 1,
                    limit = 10,
                    search = "",
                    sortBy = "start_date",
                    sortOrder = "desc",
                } = request.query;

                const skip = (parseInt(page) - 1) * parseInt(limit);

                // Build search filter
                const filter = { student_id: studentId };
                if (search) {
                    filter.$or = [
                        { subscription_type: { $regex: search, $options: "i" } },
                        { payment_status: { $regex: search, $options: "i" } },
                        { razorpay_order_id: { $regex: search, $options: "i" } },
                    ];
                }

                // Count total documents
                const total = await parentsubscriptionModel.countDocuments(filter);

                // Fetch paginated & sorted data
                const history = await parentsubscriptionModel
                    .find(filter)
                    .populate("location_id", "name location baseUrl")
                    .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean();

                const result = history.map((h) => ({
                    subscription_type: h.subscription_type,
                    amount: h.amount,
                    razorpay_order_id: h.razorpay_order_id,
                    razorpay_payment_id: h.razorpay_payment_id,
                    payment_status: h.payment_status,
                    start_date: h.start_date,
                    expire_date: h.expire_date,
                    is_active: h.is_active,
                    location: h.location_id,
                }));

                return reply.code(200).send({
                    success: true,
                    count: result.length,
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit)),
                    data: result,
                });
            } catch (error) {
                console.error(error);
                return reply.code(500).send({
                    success: false,
                    message: "Internal Server Error",
                    error: error.message,
                });
            }
        }
    );

}
