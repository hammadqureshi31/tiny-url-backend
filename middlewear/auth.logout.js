// Middleware
import jwt from "jsonwebtoken";
import { User } from "../model/userModel.js";
import {
  accessTokenOptions,
  generateAccessAndRefreshToken,
  refreshTokenOptions,
} from "../controller/userControls.js";

export const verifyJWT = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      const refresh = req.cookies?.refreshToken;
      if (!refresh) {
        return res.status(401).json({ msg: "Unauthorized Request. Please login." });
      }

      try {
        const decodedRefreshToken = jwt.verify(refresh, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedRefreshToken._id);

        if (!user) {
          return res.status(401).json({ msg: "Invalid Refresh Token" });
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

        const validUser = await User.findById(user._id).select("-password -refreshToken");

        res
          .cookie("refreshToken", refreshToken, refreshTokenOptions)
          .cookie("accessToken", accessToken, accessTokenOptions);

        req.user = validUser;
        next();
      } catch (error) {
        console.error("Error verifying refresh token:", error);
        return res.status(401).json({ msg: "Invalid or Expired Refresh Token" });
      }
    } else {
      const decodedAccessToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      const user = await User.findById(decodedAccessToken._id).select("-password -refreshToken");
      if (!user) return res.status(404).send("Invalid access token");

      req.user = user;
      next();
    }
  } catch (error) {
    console.error("Error in verifying token:", error);
    res.status(403).json({ msg: "Token verification failed" });
  }
};
