# EventHub — Event Management & Ticketing Micro-SaaS Platform

A full-stack, multi-tenant Event Management and Ticketing Micro-SaaS platform built with **React (Vite)**, **Node.js/Express**, and **MongoDB**. The platform provides atomic ticket reservation, role-based access control (Customer vs. Organizer), dynamic QR code generation for gate check-ins, and real-time revenue analytics with automated platform commission handling.

---

## Key Features

* **Role-Based Access Control (RBAC):** Distinct workflows and access layers for **Customers** and **Organizers** secured via JSON Web Tokens (JWT).
* **Atomic Ticket Booking Engine:** Prevents race conditions and overbooking when multiple users book tickets simultaneously.
* **Organizer Dashboard & Analytics:** Organizers can publish events, manage capacities, and view net earnings after the platform's 5% automated commission cut.
* **Dynamic QR Code Tickets:** Generates digital tickets embedded with verification tokens using `qrcode.react`.
* **Gate Check-In / Token Verification:** Built-in scanner/token validator on the organizer dashboard for instant ticket authentication and status updates.
* **Monorepo Architecture:** Clean directory separation between the backend API and frontend client with a unified `.gitignore`.

---

## Tech Stack

* **Frontend:** React 19 (Vite), Tailwind CSS v4, Axios, React Router Dom, Lucide React, QRCode.react
* **Backend:** Node.js, Express.js, MongoDB, Mongoose, JSON Web Tokens (JWT), bcryptjs, CORS
* **Architecture:** Monorepo, RESTful API architecture

---

## Project Structure

```text
Event-Booking-System/
├── backend/
│   ├── config/          # Database configuration
│   ├── controllers/     # Route logic (Auth, Events, Bookings, Analytics)
│   ├── middleware/      # Auth & RBAC verification
│   ├── models/          # Mongoose schemas (User, Event, Booking)
│   ├── routes/          # REST API endpoints
│   ├── .env.example     # Backend environment template
│   ├── package.json
│   └── server.js        # Server entry point
├── frontend/
│   ├── src/
│   │   ├── api/         # Axios centralized instance with auth interceptors
│   │   ├── components/  # Navbar, ProtectedRoute, EventCard, TicketVerifier
│   │   ├── context/     # AuthContext & state management
│   │   ├── pages/       # Home, Login, Register, Dashboard, MyTickets
│   │   ├── App.jsx      # Routing configuration
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md

---

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher)
* [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas cluster)
* [Git](https://git-scm.com/)

---

### Installation & Local Setup

#### 1. Clone the repository
```bash
git clone [https://github.com/shara-kmrn/Event-Booking-System.git](https://github.com/shara-kmrn/Event-Booking-System.git)
cd Event-Booking-System

#### 2. Backend setup
Navigate to the backend directory, install dependencies, and configure your environment:

cd backend
npm install

Create a .env file inside the backend directory:

Code snippet
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PLATFORM_FEE_PERCENTAGE=5

Start the backend development server:

Bash
npm run dev

3. Frontend Setup
Open a new terminal tab, navigate to the frontend directory, and install dependencies:

Bash
cd frontend
npm install
Start the Vite development server:

Bash
npm run dev
