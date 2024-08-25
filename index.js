import express from "express";
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

// CORS configuration
const allowedOrigins = ["https://tiny-url-frontend.vercel.app", "https://tiny-url-backend.vercel.app"];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        const msg = "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
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
app.set('trust proxy', 1); // Trust first proxy if behind one
app.use(
  session({
    secret: "tiny-url-backend-session", // Replace with your own secret key
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true, // Ensure HTTPS
      sameSite: 'none', // For cross-site cookies
      httpOnly: true, // Helps prevent cross-site scripting attacks
    },
    proxy: true, // Required for cookies to work behind proxies like Vercel
  })
);

// Passport middleware setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://tiny-url-backend.vercel.app/auth/google/callback",
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        console.log("user from google", user)

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

      console.log("req user at tokens", req.user)
      // Set cookies
      res.cookie("refreshToken", refreshToken, refreshTokenOptions);
      res.cookie("accessToken", accessToken, accessTokenOptions);

      res.redirect("https://tiny-url-frontend.vercel.app");
    } catch (error) {
      console.error("Error generating tokens:", error);
      res.status(500).send("Failed to generate tokens.");
    }
  }
);

app.use("/url", urlRoutes);
app.use("/user", userRoutes);

mongoose.connect(process.env.MONGODB_URL).then(() => {
  app.listen(process.env.PORT, () => {
    console.log("Connected to MongoDB");
    console.log(`App is listening on port ${process.env.PORT}`);
  });
}).catch(err => {
  console.error('Error connecting to MongoDB:', err);
});
