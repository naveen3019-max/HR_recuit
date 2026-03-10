import { ZodError } from "zod";
import logger from "../utils/logger.js";

export const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.originalUrl}`);
  err.status = 404;
  next(err);
};

export const errorHandler = (err, req, res, next) => {
  logger.error(
    {
      path: req.originalUrl,
      method: req.method,
      status: err.status || err.statusCode || 500,
      stack: err.stack
    },
    err.message || "Unhandled server error"
  );

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.errors
    });
  }

  return res.status(err.status || err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
};
