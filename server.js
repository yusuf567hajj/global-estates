const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Stripe = require("stripe");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

/*
|--------------------------------------------------------------------------
| Services
|--------------------------------------------------------------------------
*/

const stripe = process.env.STRIPE_SECRET_KEY
  ? Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/*
|--------------------------------------------------------------------------
| Basic middleware
|--------------------------------------------------------------------------
*/

app.use(cors());

/*
|--------------------------------------------------------------------------
| PAYSTACK WEBHOOK
|--------------------------------------------------------------------------
| IMPORTANT:
| This route must use express.raw() so Paystack's signature can be verified.
|--------------------------------------------------------------------------
*/

app.post(
  "/api/paystack/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const crypto = require("crypto");

      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      const signature = req.headers["x-paystack-signature"];

      if (!secretKey || !signature) {
        console.error("Paystack webhook: missing secret key or signature");
        return res.status(401).json({
          received: false,
          error: "Unauthorized"
        });
      }

      const expectedSignature = crypto
        .createHmac("sha512", secretKey)
        .update(req.body)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.error("Paystack webhook: invalid signature");

        return res.status(401).json({
          received: false,
          error: "Invalid signature"
        });
      }

      const event = JSON.parse(req.body.toString("utf8"));

      console.log("Paystack event:", event.event);

      if (event.event === "charge.success") {
        console.log(
          "Paystack payment successful:",
          event.data?.reference
        );

        console.log(
          "Amount:",
          event.data?.amount
        );

        console.log(
          "Customer:",
          event.data?.customer?.email
        );
      }

      return res.sendStatus(200);

    } catch (error) {
      console.error(
        "Paystack webhook error:",
        error.message
      );

      return res.sendStatus(400);
    }
  }
);

/*
|--------------------------------------------------------------------------
| STRIPE WEBHOOK
|--------------------------------------------------------------------------
| Kept for compatibility with the previous Global Estates setup.
|--------------------------------------------------------------------------
*/

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    if (!stripe) {
      return res.status(200).json({
        received: true,
        message: "Stripe is not configured"
      });
    }

    try {
      const signature =
        req.headers["stripe-signature"];

      const webhookSecret =
        process.env.STRIPE_WEBHOOK_SECRET;

      if (!signature || !webhookSecret) {
        return res.status(400).json({
          error: "Stripe webhook configuration missing"
        });
      }

      const event =
        stripe.webhooks.constructEvent(
          req.body,
          signature,
          webhookSecret
        );

      console.log(
        "Stripe event:",
        event.type
      );

      if (
        event.type ===
        "checkout.session.completed"
      ) {
        const session = event.data.object;

        console.log(
          "Stripe payment successful:",
          session.id
        );
      }

      return res.sendStatus(200);

    } catch (error) {
      console.error(
        "Stripe webhook error:",
        error.message
      );

      return res.status(400).send(
        `Webhook Error: ${error.message}`
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| JSON middleware
|--------------------------------------------------------------------------
| This MUST come after the raw webhook routes.
|--------------------------------------------------------------------------
*/

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true
  })
);

/*
|--------------------------------------------------------------------------
| PAYSTACK PAYMENT INITIALIZATION
|--------------------------------------------------------------------------
*/

app.post(
  "/api/paystack/initialize",
  async (req, res) => {
    try {
      const {
        email,
        amount,
        reference,
        metadata
      } = req.body;

      console.log(
        "Paystack initialization request:",
        {
          email,
          amount,
          reference
        }
      );

      /*
      |--------------------------------------------------------------------------
      | Validate request
      |--------------------------------------------------------------------------
      */

      if (!email || !amount) {
        return res.status(400).json({
          status: false,
          error:
            "Email and amount are required"
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Validate Paystack secret key
      |--------------------------------------------------------------------------
      */

      if (!process.env.PAYSTACK_SECRET_KEY) {
        console.error(
          "PAYSTACK_SECRET_KEY is missing"
        );

        return res.status(500).json({
          status: false,
          error:
            "Paystack is not configured on the server"
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Generate reference if one wasn't supplied
      |--------------------------------------------------------------------------
      */

      const paymentReference =
        reference ||
        `GE-${Date.now()}-${Math.floor(
          Math.random() * 100000
        )}`;

      /*
      |--------------------------------------------------------------------------
      | Paystack request
      |--------------------------------------------------------------------------
      */

      const response = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            email: email,

            /*
            | Paystack expects amount in the smallest
            | currency unit.
            |
            | Example:
            | KES 1,000 = 100000 cents
            */
            amount:
              Math.round(
                Number(amount) * 100
              ),

            currency: "KES",

            reference:
              paymentReference,

            callback_url:
              "https://global-estates.onrender.com/payment-success.html",

            metadata:
              metadata || {}
          })
        }
      );

      const data =
        await response.json();

      console.log(
        "Paystack response:",
        data
      );

      /*
      |--------------------------------------------------------------------------
      | Check Paystack response
      |--------------------------------------------------------------------------
      */

      if (
        !response.ok ||
        !data.status
      ) {
        return res.status(400).json({
          status: false,

          error:
            data.message ||
            "Paystack initialization failed",

          details: data
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Return checkout information
      |--------------------------------------------------------------------------
      */

      return res.json({
        status: true,

        authorization_url:
          data.data.authorization_url,

        access_code:
          data.data.access_code,

        reference:
          data.data.reference
      });

    } catch (error) {
      console.error(
        "Paystack initialization error:",
        error
      );

      return res.status(500).json({
        status: false,
        error:
          "Payment initialization failed"
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| PROPERTY API
|--------------------------------------------------------------------------
| Temporary in-memory storage.
|
| IMPORTANT:
| This works for testing, but properties will disappear when
| the Render service restarts. A database should be added later.
|--------------------------------------------------------------------------
*/

const properties = [];

/*
|--------------------------------------------------------------------------
| CREATE PROPERTY
|--------------------------------------------------------------------------
*/

app.post(
  "/api/properties",
  (req, res) => {
    try {
      const property = req.body;

      if (!property) {
        return res.status(400).json({
          status: false,
          error:
            "Property data is required"
        });
      }

      const newProperty = {
        id:
          `GE-${Date.now()}-${Math.floor(
            Math.random() * 10000
          )}`,

        ...property,

        createdAt:
          new Date().toISOString()
      };

      properties.push(newProperty);

      console.log(
        "Property created:",
        newProperty.id
      );

      return res.status(201).json({
        status: true,
        property: newProperty
      });

    } catch (error) {
      console.error(
        "Property creation error:",
        error
      );

      return res.status(500).json({
        status: false,
        error:
          "Unable to create property"
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET ALL PROPERTIES
|--------------------------------------------------------------------------
*/

app.get(
  "/api/properties",
  (req, res) => {
    return res.json({
      status: true,
      properties
    });
  }
);

/*
|--------------------------------------------------------------------------
| GET ONE PROPERTY
|--------------------------------------------------------------------------
*/

app.get(
  "/api/properties/:id",
  (req, res) => {
    const property =
      properties.find(
        item =>
          item.id === req.params.id
      );

    if (!property) {
      return res.status(404).json({
        status: false,
        error:
          "Property not found"
      });
    }

    return res.json({
      status: true,
      property
    });
  }
);

/*
|--------------------------------------------------------------------------
| BOOKING API
|--------------------------------------------------------------------------
*/

const bookings = [];

app.post(
  "/api/bookings",
  (req, res) => {
    try {
      const booking = {
        id:
          `BOOK-${Date.now()}`,

        ...req.body,

        createdAt:
          new Date().toISOString()
      };

      bookings.push(booking);

      console.log(
        "Booking created:",
        booking.id
      );

      return res.status(201).json({
        status: true,
        booking
      });

    } catch (error) {
      console.error(
        "Booking error:",
        error
      );

      return res.status(500).json({
        status: false,
        error:
          "Unable to create booking"
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET BOOKINGS
|--------------------------------------------------------------------------
*/

app.get(
  "/api/bookings",
  (req, res) => {
    return res.json({
      status: true,
      bookings
    });
  }
);

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get(
  "/api/health",
  (req, res) => {
    return res.status(200).json({
      status: "ok",

      service:
        "Global Estates",

      paystack:
        Boolean(
          process.env.PAYSTACK_SECRET_KEY
        ),

      timestamp:
        new Date().toISOString()
    });
  }
);

/*
|--------------------------------------------------------------------------
| STATIC WEBSITE
|--------------------------------------------------------------------------
*/

app.use(
  express.static("public")
);

/*
|--------------------------------------------------------------------------
| ROOT ROUTE
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      require("path").join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/*
|--------------------------------------------------------------------------
| 404 API HANDLER
|--------------------------------------------------------------------------
*/

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      status: false,
      error: "API endpoint not found"
    });
  }
);

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Global Estates running on port ${PORT}`
    );

    console.log(
      "Paystack configured:",
      Boolean(
        process.env.PAYSTACK_SECRET_KEY
      )
    );

    console.log(
      "Stripe configured:",
      Boolean(
        process.env.STRIPE_SECRET_KEY
      )
    );
  }
);
