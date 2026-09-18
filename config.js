import dotenv from "dotenv";

dotenv.config();

export const RP_NAME = "Cubyz Hub";
export const RP_ORIGIN = process.env.DOMAIN || "http://localhost:3000";
export const RP_ID = new URL(RP_ORIGIN).hostname;
