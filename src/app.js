import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import whatsappRoutes from "./routes/whatsapp.routes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    req.setTimeout(60000);
    res.setTimeout(60000);
    next();
});

app.use((req, res, next) => {
    const key = req.headers["x-api-key"];
    if (key !== process.env.API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
});

app.use("/api/whatsapp", whatsappRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀  API running on port ${PORT}`));
