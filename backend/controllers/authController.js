import { loginUser, registerUser } from "../services/authService.js";

export const register = async (req, res, next) => {
  try {
    const result = await registerUser(req.validated.body);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const result = await loginUser(req.validated.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

export const me = async (req, res) => {
  return res.json({ user: req.user });
};
