import dotenv from "dotenv";
import { loadEnv } from "./config";

dotenv.config();

export const env = loadEnv(process.env);

