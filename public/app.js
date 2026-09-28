// Global Estates - Frontend Application

document.addEventListener("DOMContentLoaded", () => {
  initializeNavigation();
  initializeSearch();
  initializePropertyActions();
  initializeForms();
  initializeCountryButtons();
  loadSavedListings();
});

/* =========================
   MOBILE NAVIGATION
========================= */

function initializeNavigation() {
  const menuButton = document.querySelector(".menu-btn");
  const navLinks = document.querySelector(".nav-links");

  if (menuButton && navLinks) {
    menuButton.addEventListener("click", () => {
      navLinks.classList.toggle("active");
    });
  }

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks?.classList.remove("active");
    });
  });
}

/* =========================
   PROPERTY SEARCH
========================= */

function initializeSearch() {
  const searchForm = document.querySelector("#propertySearch");

  if (!searchForm) return;

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const location =
      document.querySelector("#searchLocation")?.value.trim() || "";

    const type =
      document.querySelector("#searchType")?.value || "";

    const purpose =
      document.querySelector("#searchPurpose")?.value || "";

    const params = new URLSearchParams();

    if (location) params.set("location", location);
    if (type) params.set("type", type);
    if (purpose) params.set("purpose", purpose);

    window.location.href = `properties.html?${params.toString()}`;
  });
}

/* =========================
   PROPERTY ACTIONS
========================= */

function initializePropertyActions() {
  document.querySelectorAll("[data-property-id]").forEach((card) => {
    const propertyId = card.dataset.propertyId;

    const saveButton = card.querySelector(".save-property");

    if (saveButton) {
      updateSaveButton(saveButton, propertyId);

      saveButton.addEventListener("click", () => {
        toggleSavedProperty(propertyId, saveButton);
      });
    }
  });

  document.querySelectorAll(".contact-owner").forEach((button) => {
    button.addEventListener("click", () => {
      const phone = button.dataset.phone;

      if (!phone) {
        showMessage("Owner contact information is not available.");
        return;
      }

      const message =
        button.dataset.message ||
        "Hello, I am interested in your property listed on Global Estates.";

      const whatsappUrl =
        `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

      window.open(whatsappUrl, "_blank");
    });
  });
}

/* =========================
   SAVED LISTINGS
========================= */

function loadSavedListings() {
  const saved = getSavedProperties();

  document.querySelectorAll("[data-property-id]").forEach((card) => {
    const id = card.dataset.propertyId;
    const button = card.querySelector(".save-property");

    if (button) {
      updateSaveButton(button, id);
    }
  });

  return saved;
}

function getSavedProperties() {
  try {
    return JSON.parse(localStorage.getItem("globalEstatesSaved") || "[]");
  } catch {
    return [];
  }
}

function toggleSavedProperty(propertyId, button) {
  let saved = getSavedProperties();

  if (saved.includes(propertyId)) {
    saved = saved.filter((id) => id !== propertyId);
    showMessage("Property removed from saved listings.");
  } else {
    saved.push(propertyId);
    showMessage("Property saved successfully.");
  }

  localStorage.setItem("globalEstatesSaved", JSON.stringify(saved));

  updateSaveButton(button, propertyId);
}

function updateSaveButton(button, propertyId) {
  const saved = getSavedProperties();
  const isSaved = saved.includes(propertyId);

  button.textContent = isSaved
    ? "♥ Saved"
    : "♡ Save";

  button.classList.toggle("saved", isSaved);
}

/* =========================
   COUNTRY BUTTONS
========================= */

function initializeCountryButtons() {
  document.querySelectorAll("[data-country]").forEach((button) => {
    button.addEventListener("click", () => {
      const country = button.dataset.country;

      if (!country) return;

      window.location.href =
        `properties.html?country=${encodeURIComponent(country)}`;
    });
  });
}

/* =========================
   PROPERTY CONTACT FORM
========================= */

function initializeForms() {
  const forms = document.querySelectorAll("form[data-form]");

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const formType = form.dataset.form;

      if (formType === "contact") {
        handleContactForm(form);
      }

      if (formType === "property") {
        handlePropertyForm(form);
      }

      if (formType === "booking") {
        handleBookingForm(form);
      }
    });
  });
}

function handleContactForm(form) {
  const name = form.querySelector('[name="name"]')?.value.trim();
  const email = form.querySelector('[name="email"]')?.value.trim();
  const message = form.querySelector('[name="message"]')?.value.trim();

  if (!name || !email || !message) {
    showMessage("Please complete all required fields.", "error");
    return;
  }

  showMessage(
    "Your message has been submitted. We will get back to you soon.",
    "success"
  );

  form.reset();
}

function handlePropertyForm(form) {
  const title = form.querySelector('[name="title"]')?.value.trim();
  const location = form.querySelector('[name="location"]')?.value.trim();
  const price = form.querySelector('[name="price"]')?.value;

  if (!title || !location || !price) {
    showMessage("Please complete the required property details.", "error");
    return;
  }

  showMessage(
    "Property details saved. Connect the backend/payment system to publish the listing.",
    "success"
  );
}

function handleBookingForm(form) {
  const name = form.querySelector('[name="name"]')?.value.trim();
  const date = form.querySelector('[name="date"]')?.value;

  if (!name || !date) {
    showMessage("Please provide your name and booking date.", "error");
    return;
  }

  showMessage(
    "Booking request submitted successfully.",
    "success"
  );

  form.reset();
}

/* =========================
   MESSAGE NOTIFICATION
========================= */

function showMessage(message, type = "info") {
  let container = document.querySelector("#globalMessage");

  if (!container) {
    container = document.createElement("div");
    container.id = "globalMessage";

    Object.assign(container.style, {
      position: "fixed",
      top: "85px",
      right: "20px",
      zIndex: "9999",
      maxWidth: "350px",
      padding: "14px 18px",
      borderRadius: "8px",
      fontWeight: "600",
      boxShadow: "0 8px 25px rgba(0,0,0,.15)"
    });

    document.body.appendChild(container);
  }

  container.textContent = message;

  if (type === "success") {
    container.style.background = "#dcfce7";
    container.style.color = "#166534";
  } else if (type === "error") {
    container.style.background = "#fee2e2";
    container.style.color = "#991b1b";
  } else {
    container.style.background = "#dbeafe";
    container.style.color = "#1e40af";
  }

  container.style.display = "block";

  setTimeout(() => {
    container.style.display = "none";
  }, 4000);
}

/* =========================
   URL PARAMETERS
========================= */

function getQueryParameters() {
  const params = new URLSearchParams(window.location.search);

  return {
    country: params.get("country") || "",
    location: params.get("location") || "",
    type: params.get("type") || "",
    purpose: params.get("purpose") || ""
  };
}

/* =========================
   PROPERTY FILTERING
========================= */

function filterProperties() {
  const filters = getQueryParameters();

  const cards = document.querySelectorAll("[data-property-card]");

  cards.forEach((card) => {
    const country = (
      card.dataset.country || ""
    ).toLowerCase();

    const location = (
      card.dataset.location || ""
    ).toLowerCase();

    const type = (
      card.dataset.type || ""
    ).toLowerCase();

    const purpose = (
      card.dataset.purpose || ""
    ).toLowerCase();

    const countryMatch =
      !filters.country ||
      country.includes(filters.country.toLowerCase());

    const locationMatch =
      !filters.location ||
      location.includes(filters.location.toLowerCase());

    const typeMatch =
      !filters.type ||
      type === filters.type.toLowerCase();

    const purposeMatch =
      !filters.purpose ||
      purpose === filters.purpose.toLowerCase();

    card.style.display =
      countryMatch &&
      locationMatch &&
      typeMatch &&
      purposeMatch
        ? ""
        : "none";
  });
}

filterProperties();

/* =========================
   PRICE FORMATTER
========================= */

function formatPrice(amount, currency = "KES") {
  const number = Number(amount);

  if (Number.isNaN(number)) return amount;

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency
  }).format(number);
}

/* =========================
   GLOBAL ESTATES API HELPER
========================= */

async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Something went wrong."
      );
    }

    return data;
  } catch (error) {
    console.error("Global Estates API error:", error);
    throw error;
  }
}

/* =========================
   STRIPE PAYMENT HELPER
========================= */

async function startStripeCheckout(plan, listingId) {
  try {
    const response = await apiRequest(
      "/api/create-checkout-session",
      {
        method: "POST",
        body: JSON.stringify({
          plan,
          listingId
        })
      }
    );

    if (response.url) {
      window.location.href = response.url;
      return;
    }

    showMessage(
      "Unable to start payment. Please try again.",
      "error"
    );
  } catch (error) {
    showMessage(
      "Payment could not be started.",
      "error"
    );
  }
}

/* =========================
   OWNER PLAN SELECTION
========================= */

document.querySelectorAll("[data-plan]").forEach((button) => {
  button.addEventListener("click", () => {
    const plan = button.dataset.plan;
    const listingId = button.dataset.listingId;

    if (!plan) return;

    startStripeCheckout(plan, listingId || null);
  });
});

/* =========================
   BOOKING
========================= */

async function createBooking(bookingData) {
  try {
    const result = await apiRequest(
      "/api/bookings",
      {
        method: "POST",
        body: JSON.stringify(bookingData)
      }
    );

    showMessage(
      result.message || "Booking created successfully.",
      "success"
    );

    return result;
  } catch (error) {
    showMessage(
      "Unable to create booking.",
      "error"
    );

    return null;
  }
}

/* =========================
   EXPORT FOR OTHER SCRIPTS
========================= */

window.GlobalEstates = {
  showMessage,
  getQueryParameters,
  formatPrice,
  apiRequest,
  startStripeCheckout,
  createBooking,
  toggleSavedProperty
};
