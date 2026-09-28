const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Stripe = require("stripe");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

app.use(cors());

// Stripe webhook needs the raw request body.
// Keep this route BEFORE express.json().
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.json({ received: true });
    }

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      switch (event.type) {
        case "checkout.session.completed":
          console.log(
            "Stripe payment completed:",
            event.data.object.id
          );
          break;

        case "checkout.session.expired":
          console.log(
            "Stripe checkout expired:",
            event.data.object.id
          );
          break;

        default:
          console.log(`Unhandled Stripe event: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error.message);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the Global Estates frontend
app.use(express.static("public"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Global Estates API is running."
  });
});

// Homepage fallback
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

/*
  STRIPE CHECKOUT

  The frontend sends:
  {
    plan: "featured",
    listingId: "123"
  }
*/

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe has not been configured yet."
      });
    }

    const { plan, listingId } = req.body;

    const plans = {
      featured: {
        name: "Featured Property Listing",
        amount: 1000
      },

      premium: {
        name: "Premium Property Listing",
        amount: 2500
      }
    };

    const selectedPlan = plans[plan];

    if (!selectedPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing plan."
      });
    }

    const baseUrl =
      process.env.APP_URL ||
      `${req.protocol}://${req.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "kes",

            product_data: {
              name: selectedPlan.name,
              description:
                "Global Estates property listing upgrade"
            },

            unit_amount: selectedPlan.amount * 100
          },

          quantity: 1
        }
      ],

      metadata: {
        plan,
        listingId: listingId || ""
      },

      success_url:
        `${baseUrl}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${baseUrl}/payment-cancelled.html`
    });

    res.json({
      success: true,
      url: session.url
    });
  } catch (error) {
    console.error("Stripe Checkout error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create Stripe checkout session."
    });
  }
});

/*
  VERIFY STRIPE PAYMENT
*/

app.get("/api/verify-payment/:sessionId", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe has not been configured."
      });
    }

    const session = await stripe.checkout.sessions.retrieve(
      req.params.sessionId
    );

    res.json({
      success: true,
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_details?.email || null,
      metadata: session.metadata
    });
  } catch (error) {
    console.error("Payment verification error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to verify payment."
    });
  }
});

/*
  BASIC BOOKING ENDPOINT

  This is the foundation.
  We'll connect it to a real database later.
*/

app.post("/api/bookings", async (req, res) => {
  try {
    const {
      propertyId,
      name,
      email,
      phone,
      checkIn,
      checkOut,
      guests
    } = req.body;

    if (!propertyId || !name || !email) {
      return res.status(400).json({
        success: false,
        message:
          "Property, name and email are required."
      });
    }

    const booking = {
      id: `booking_${Date.now()}`,
      propertyId,
      name,
      email,
      phone: phone || "",
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      guests: guests || 1,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    console.log("New booking:", booking);

    res.status(201).json({
      success: true,
      message: "Booking request received.",
      booking
    });
  } catch (error) {
    console.error("Booking error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create booking."
    });
  }
});

/*
  CONTACT OWNER
*/

app.post("/api/contact-owner", (req, res) => {
  const {
    propertyId,
    name,
    email,
    phone,
    message
  } = req.body;

  if (!propertyId || !name || !message) {
    return res.status(400).json({
      success: false,
      message:
        "Property, name and message are required."
    });
  }

  console.log("Owner contact request:", {
    propertyId,
    name,
    email,
    phone,
    message
  });

  res.json({
    success: true,
    message: "Your message has been sent to the property owner."
  });
});

/*
  404 API HANDLER
*/

app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found."
  });
});

/*
  START SERVER
*/

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Global Estates server running on port ${PORT}`
  );
});
