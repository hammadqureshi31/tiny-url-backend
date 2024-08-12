import express from "express";
import {
  port,
  mongodb_url,
  googleClientId,
  googleClientSecret,
} from "./config.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import passport from "passport";
import session from "express-session";
import pkg from "passport-google-oauth20";
import urlRoutes from "./routes/urlRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { User } from "./model/userModel.js";
import {
  accessTokenOptions,
  generateAccessAndRefreshToken,
  refreshTokenOptions,
} from "./controller/userControls.js";

dotenv.config({
  path: "./.env",
});

const { Strategy: GoogleStrategy } = pkg;

const app = express();

app.use(helmet());

const allowedOrigins = ["https://tiny-url-frontend.vercel.app", "https://tiny-url-backend.vercel.app"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Custom TinyURL Backend...");
});

// Configure session middleware
app.use(
  session({
    secret: "your_secret_key", // Replace with your own secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set 'secure: true' if using HTTPS
  })
);

// Passport middleware setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: "/auth/google/callback",
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          user = new User({
            username: profile.displayName,
            email: profile.emails[0].value,
          });

          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).exec();
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Authentication routes
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "https://tiny-url-frontend.vercel.app/login",
  }),
  async (req, res, next) => {
    try {
      const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        req.user._id
      );

      // Set cookies
      res.cookie("refreshToken", refreshToken, refreshTokenOptions);
      res.cookie("accessToken", accessToken, accessTokenOptions);

      // Redirect the user after setting cookies
      res.redirect("https://tiny-url-frontend.vercel.app/");
    } catch (error) {
      console.error("Error generating tokens:", error);
      res.status(500).send("Failed to generate tokens.");
    }
  }
);

app.get("/user/me", (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user;
    res.json(user);
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

app.use("/url", urlRoutes);
app.use("/user", userRoutes);

mongoose
  .connect(mongodb_url)
  .then(() => {
    app.listen(port, () => {
      console.log("Connected to MongoDB");
      console.log(`App is listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.log("Error connecting to MongoDB: ", error);
  });
