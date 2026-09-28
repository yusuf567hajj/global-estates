require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const Stripe = require("stripe");

const app = express();

const PORT = process.env.PORT || 3000;

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

const properties = [
  {
    id: 1,
    title: "Modern Nairobi Apartment",
    location: "Nairobi, Kenya",
    type: "Apartment",
    price: 4500,
    currency: "KES",
    period: "night",
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: 2,
    title: "Beach Villa",
    location: "Mombasa, Kenya",
    type: "Vacation",
    price: 12000,
    currency: "KES",
    period: "night",
    image:
      "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1000&q=80"
  },
  {
    id: 3,
    title: "Family Home",
    location: "Kutus, Kirinyaga, Kenya",
    type: "House",
    price: 3500000,
    currency: "KES",
    period: "sale",
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80"
  }
];

app.get("/api/properties", (req, res) => {
  res.json(properties);
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Global Estates"
  });
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { propertyId } = req.body;

    const property = properties.find(
      (item) => item.id === Number(propertyId)
    );

    if (!property) {
      return res.status(404).json({
        error: "Property not found"
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: "Stripe is not configured yet."
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "kes",
            product_data: {
              name: property.title,
              description: `${property.type} in ${property.location}`
            },
            unit_amount: Math.round(property.price * 100)
          },
          quantity: 1
        }
      ],

      success_url:
        `${process.env.FRONTEND_URL || "http://localhost:3000"}` +
        "/?payment=success",

      cancel_url:
        `${process.env.FRONTEND_URL || "http://localhost:3000"}` +
        "/?payment=cancelled"
    });

    res.json({
      url: session.url
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Unable to create Stripe checkout session."
    });
  }
});

app.post("/api/vacation-commission", (req, res) => {
  const amount = Number(req.body.amount);

  if (!amount || amount <= 0) {
    return res.status(400).json({
      error: "Enter a valid amount."
    });
  }

  const commission = amount * 0.10;

  res.json({
    bookingAmount: amount,
    commissionRate: 10,
    commission,
    ownerAmount: amount - commission
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Global Estates running on port ${PORT}`);
});
