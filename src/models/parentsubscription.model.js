import mongoose from "mongoose";

const ParentSubscriptionSchema = new mongoose.Schema(
  {
    student_id: {
      type: String
    },
    location_id: {
      type: String,
      ref:"Location",
      required:true
    },
    subscription_type: {
      type: String,
      enum: ["MONTHLY", "QUARTERLY", "YEARLY"],
      default: "MONTHLY"
    },

    amount: {
      type: Number,
      required: true
    },

    razorpay_order_id: {
      type: String,
      required: true
    },

    razorpay_payment_id: {
      type: String,
    },

    payment_status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING"
    },

    start_date: {
      type: Date,
      default: Date.now
    },

    expire_date: {
      type: Date
    },

    is_active: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("ParentSubscription", ParentSubscriptionSchema);
