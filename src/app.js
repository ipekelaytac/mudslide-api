import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";
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

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Mudslide WhatsApp API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

app.use((req, res, next) => {
    if (req.path.startsWith('/api-docs')) {
        return next();
    }
    const key = req.headers["x-api-key"];
    if (key !== process.env.API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
});

app.use("/api/whatsapp", whatsappRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀  API running on port ${PORT}`));
