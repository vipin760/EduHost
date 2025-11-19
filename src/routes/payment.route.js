
import { request } from "http";
import parentsubscriptionModel from "../models/parentsubscription.model.js";
import { createOrder } from "../services/razorpay.service.js";
import getExpiryDate from "../utils/getExpirydate.js";
import crypto from 'crypto'


export default async function paymentFunction(fastify) {
    // fastify.post('/create', async (request, reply) => {
    //     console.log("working")
    //     try {
    //         const { amount, shortReceipt, studentData, locationId, subscription_type } = request.body;
    //         const order = await createOrder(amount, shortReceipt);
    //         console.log("<><>order",order)
    //         const orderData = {
    //             student_id: studentData._id,
    //             location_id: locationId,
    //             subscription_type, amount,
    //             razorpay_order_id: order.id
    //         }
    //         await parentsubscriptionModel.create(orderData)
    //         return reply.code(200).send({ order })
    //     } catch (error) {
    //         console.log(error)
    //         return reply.code(500).send({ status: false, message: "internal server down", error: error.message })
    //     }
    // })

    // fastify.post('/verify',(request,reply)=>{
    //     try {
    //         const { razorpay_order_id,razorpay_payment_id, razorpay_signature, studentId} = request.body
    //         const body = razorpay_order_id + "|" + razorpay_payment_id;
    //          const expectedSignature = crypto
    //   .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    //   .update(body.toString())
    //   .digest("hex");
    //   if (expectedSignature !== razorpay_signature) {
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "Invalid signature" });
    // }

    //   return reply.code(200).send(expectedSignature)
    //     } catch (error) {
    //          return reply.code(500).send({status:false,message:"internal server down", error:error.message})
    //     }
    // })

    fastify.post('/create', async (request, reply) => {
    try {
        const { amount, shortReceipt, studentData, locationId, subscription_type } = request.body;

        const studentId = studentData._id;
        const today = new Date();

        // 1️⃣ Check if valid active subscription exists
        const activeSub = await parentsubscriptionModel.findOne({
            student_id: studentId,
            payment_status: "SUCCESS",
            is_active: true,
            expire_date: { $gte: today } // expire future
        });

        if (activeSub) {
            // Calculate remaining days
            const diffMs = new Date(activeSub.expire_date) - today;
            const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            return reply.code(200).send({
                success: true,
                subscription:true,
                message: `You already have an active subscription. ${remainingDays} day(s) remaining.`,
                subscription: activeSub
            });
        }

        // 2️⃣ No active plan → Create order
        const order = await createOrder(amount, shortReceipt);

        const orderData = {
            student_id: studentId,
            location_id: locationId,
            subscription_type,
            amount,
            razorpay_order_id: order.id
        };

        await parentsubscriptionModel.create(orderData);

        return reply.code(200).send({
            success: true,
            order
        });

    } catch (error) {
        console.log(error);
        return reply.code(500).send({
            status: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
});

    fastify.post('/verify', async (request, reply) => {
        try {
            const {
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                studentId,subscription_type="YEARLY"
            } = request.body;

            // 1. Verify Signature
            const body = razorpay_order_id + "|" + razorpay_payment_id;

            const expectedSignature = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest("hex");

            if (expectedSignature !== razorpay_signature) {
                // ❌ Signature Mismatch → Mark payment FAILED
                await parentsubscriptionModel.findOneAndUpdate(
                    { razorpay_order_id },
                    {
                        payment_status: "FAILED",
                        razorpay_payment_id
                    }
                );

                return reply.code(400).send({
                    success: false,
                    message: "Invalid signature"
                });
            }

            // 2. Signature OK → Update Subscription to SUCCESS
            const updatedSub = await parentsubscriptionModel.findOneAndUpdate(
                { razorpay_order_id },
                {
                    payment_status: "SUCCESS",
                    razorpay_payment_id,
                    is_active: true,
                    start_date: new Date(),
                    expire_date: getExpiryDate(subscription_type)
                },
                { new: true }
            );

            return reply.code(200).send({
                success: true,
                message: "Payment verified and subscription activated",
                subscription: updatedSub
            });

        } catch (error) {
            return reply
                .code(500)
                .send({ status: false, message: "Internal Server Error", error: error.message });
        }
    });

    fastify.put('/update',async(request,reply)=>{
        try {
            const { studentId } = request.body
            await parentsubscriptionModel.updateOne({student_id:studentId},{is_active:false})
            return reply.code(200).send(true)
        } catch (error) {
            return reply
                .code(500)
                .send({ status: false, message: "Internal Server Error", error: error.message });
        }
    })

}