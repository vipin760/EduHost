import parentsubscriptionModel from "../models/parentsubscription.model.js";


export default async function subscriberFunction(fastify) {
    fastify.get('/', async (request, reply) => {
        try {
            const today = new Date();

            const subscribers = await parentsubscriptionModel.find({
                is_active: true,
                payment_status: "SUCCESS",
                expire_date: { $gte: today }
            }).populate("location_id", "name location baseUrl").lean();

            const result = subscribers.map(sub => {
                const remainingDays = sub.expire_date
                    ? Math.ceil((new Date(sub.expire_date) - today) / (1000 * 60 * 60 * 24))
                    : null;

                return {
                    id: sub._id,
                    student_id: sub.student_id,
                    location: sub.location_id,
                    subscription_type: sub.subscription_type,
                    amount: sub.amount,
                    payment_status: sub.payment_status,
                    start_date: sub.start_date,
                    expire_date: sub.expire_date,
                    remaining_days: remainingDays
                };
            });
            const totalSubscribers = await parentsubscriptionModel.countDocuments({
                is_active: true,
                payment_status: "SUCCESS",
                expire_date: { $gte: today }
            });
            return reply.code(200).send({ success: true, data: result,totalSubscribers });
        } catch (error) {
            console.error(error);
            return reply.code(500).send({ success: false, message: "Internal Server Error", error: error.message });
        }
    });

    fastify.get('/:studentId/history', async (request, reply) => {
        try {
            const { studentId } = request.params;

            const history = await parentsubscriptionModel.find({ student_id: studentId })
                .sort({ start_date: -1 })
                .populate("location_id", "name location baseUrl")
                .lean();

            const result = history.map(h => ({
                subscription_type: h.subscription_type,
                amount: h.amount,
                razorpay_order_id: h.razorpay_order_id,
                razorpay_payment_id: h.razorpay_payment_id,
                payment_status: h.payment_status,
                start_date: h.start_date,
                expire_date: h.expire_date,
                is_active: h.is_active,
                location: h.location_id
            }));

            return reply.code(200).send({ success: true, data: result });
        } catch (error) {
            console.error(error);
            return reply.code(500).send({ success: false, message: "Internal Server Error", error: error.message });
        }
    });


}