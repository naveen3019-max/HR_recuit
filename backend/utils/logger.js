import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: ["req.headers.authorization", "password", "token"],
    remove: true
  }
});

export const logInfo = (message, meta = {}) => logger.info(meta, message);
export const logError = (message, meta = {}) => logger.error(meta, message);
export default logger;
