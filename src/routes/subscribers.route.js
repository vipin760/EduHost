import parentsubscriptionModel from "../models/parentsubscription.model.js";
import { Location } from "../models/location.model.js";
import authenticateToken from "../middleware/auth.middleware.js";
import mongoose from "mongoose";

export default async function subscriberFunction(fastify) {

  // ============================================================
  // 1️⃣ LOCATIONS + STATS
  // ============================================================
  fastify.get(
    "/locations/stats",
    { preHandler: authenticateToken },
    async (req, reply) => {
      try {
        const today = new Date();

        const stats = await Location.aggregate([
          {
            $lookup: {
              from: "parentsubscriptions",
              localField: "_id",
              foreignField: "location_id",
              as: "subs",
            },
          },

          {
            $project: {
              location_id: "$_id",
              name: 1,
              location: 1,
              baseUrl: 1,

              // TOTAL UNIQUE STUDENTS
              total_subscribers: {
                $size: {
                  $setUnion: [
                    {
                      $map: {
                        input: "$subs",
                        as: "s",
                        in: "$$s.student_id",
                      },
                    },
                    [],
                  ],
                },
              },

              // ACTIVE UNIQUE STUDENTS
              active_subscribers: {
                $size: {
                  $setUnion: [
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: "$subs",
                            as: "s",
                            cond: {
                              $and: [
                                { $eq: ["$$s.payment_status", "SUCCESS"] },
                                { $eq: ["$$s.is_active", true] },
                                { $gte: ["$$s.expire_date", today] },
                              ],
                            },
                          },
                        },
                        as: "s",
                        in: "$$s.student_id",
                      },
                    },
                    [],
                  ],
                },
              },

              // EXPIRED UNIQUE STUDENTS
              expired_subscribers: {
                $size: {
                  $setUnion: [
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: "$subs",
                            as: "s",
                            cond: {
                              $and: [
                                { $eq: ["$$s.payment_status", "SUCCESS"] },
                                { $lt: ["$$s.expire_date", today] },
                              ],
                            },
                          },
                        },
                        as: "s",
                        in: "$$s.student_id",
                      },
                    },
                    [],
                  ],
                },
              },

              // TOTAL REVENUE
              total_revenue: {
                $sum: {
                  $map: {
                    input: "$subs",
                    as: "s",
                    in: {
                      $cond: [
                        { $eq: ["$$s.payment_status", "SUCCESS"] },
                        { $toDouble: "$$s.amount" },
                        0,
                      ],
                    },
                  },
                },
              },
            },
          },
        ]);

        return reply.code(200).send({ success: true, data: stats });
      } catch (err) {
        console.error(err);
        return reply
          .code(500)
          .send({ success: false, message: "Internal Server Error" });
      }
    }
  );

  // ============================================================
  // 2️⃣ SUBSCRIBERS BY LOCATION
  // ============================================================
  fastify.get(
    "/location/:locationId",
    { preHandler: authenticateToken },
    async (request, reply) => {
      try {
        const { locationId } = request.params;
        const today = new Date();

        const subscribers = await parentsubscriptionModel.aggregate([
          {
            $match: {
              location_id: new mongoose.Types.ObjectId(locationId),
              payment_status: "SUCCESS",
              expire_date: { $gte: today },
            },
          },
          { $sort: { start_date: -1 } },
          {
            $group: {
              _id: "$student_id",
              latestSub: { $first: "$$ROOT" },
            },
          },
          {
            $lookup: {
              from: "locations",
              localField: "latestSub.location_id",
              foreignField: "_id",
              as: "location",
            },
          },
          { $unwind: "$location" },
          {
            $project: {
              id: "$latestSub._id",
              student_id: "$_id",
              subscription_type: "$latestSub.subscription_type",
              amount: "$latestSub.amount",
              start_date: "$latestSub.start_date",
              expire_date: "$latestSub.expire_date",

              location: {
                _id: "$location._id",
                name: "$location.name",
                baseUrl: "$location.baseUrl",
                location: "$location.location",
              },
            },
          },
        ]);

        return reply.code(200).send({
          success: true,
          count: subscribers.length,
          data: subscribers,
        });
      } catch (error) {
        console.error(error);
        return reply
          .code(500)
          .send({ success: false, message: "Internal Server Error" });
      }
    }
  );

  // ============================================================
  // 3️⃣ SUBSCRIPTION HISTORY BY STUDENT
  // ============================================================
  fastify.get(
    "/subscribers/history/:studentId",
    { preHandler: authenticateToken },
    async (request, reply) => {
      try {
        const { studentId } = request.params;

        const history = await parentsubscriptionModel
          .find({ student_id: studentId })
          .sort({ start_date: -1 })
          .populate("location_id", "name location baseUrl")
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

        return reply.code(200).send({ success: true, data: result });
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
