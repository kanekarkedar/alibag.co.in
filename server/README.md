# CuteStay Backend Server 🏨

This is the scalable backend API for the Hotel Booking platform. It is built with **Node.js** and **Express**.

## ⚠️ Prerequisite: Install Node.js
This system requires Node.js to run.
1.  Download from [nodejs.org](https://nodejs.org/) (LTS Version).
2.  Run the installer.
3.  Restart your terminal/VS Code.

## Setup Instructions

1.  **Install Dependencies**:
    ```bash
    cd server
    npm install
    ```

2.  **Start the Server**:
    ```bash
    npm start
    ```
    The server will run at `http://localhost:3000`.

## API Endpoints
-   `GET /api/hotels`: List all hotels
-   `GET /api/hotels/:id`: Get details
-   `POST /api/bookings`: Create a booking

## Architecture
-   **`src/app.js`**: Main application entry point.
-   **`src/routes/`**: API Route definitions.
-   **`src/controllers/`**: Logic for handling requests.
