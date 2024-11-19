import { User } from "../model/userModel.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { google } from "googleapis"

// Define options for cookies
const accessTokenMaxAge = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const refreshTokenMaxAge = 240 * 60 * 60 * 1000; // 10 days in milliseconds

export const accessTokenOptions = {
  maxAge: accessTokenMaxAge,
  httpOnly: true,
  secure: true,    // Must be true in production (for HTTPS)
  sameSite: 'none', // Use 'lax' for cross-site requests
  path: '/',
};

export const refreshTokenOptions = {
  maxAge: refreshTokenMaxAge,
  httpOnly: true,
  secure: true,    // Must be true in production (for HTTPS)
  sameSite: 'lax', // Use 'lax' for cross-site requests
  path: '/',
};



export async function generateAccessAndRefreshToken(userid) {
  try {
    const user = await User.findById(userid);
    if (!user) throw new Error("User not found");

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error in generating Access and Refresh Token", error);
    throw new Error("Token generation failed");
  }
}

export async function handleCreateNewUser(req, res) {
  const { username, email, password } = req.body;
  if (
    [username, email, password].some((field) => !field || field.trim() === "")
  ) {
    return res.status(401).send("All fields required.");
  }

  const userExist = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (userExist) {
    return res.status(409).send("User with email or username already exists");
  }

  const createUser = {
    username,
    email,
    password,
  };

  const newUser = await User.create(createUser);
  const createdUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    return res
      .status(500)
      .send("Something went wrong while registering the user");
  }

  return res.status(200).json(createdUser);
}

export async function handleCheckIsUserLoggedIn(req, res) {
  const accessToken = req.cookies?.accessToken;

  console.log("access at me ", accessToken)

  if (!accessToken) return res.status(404).send("No Access Token Found...");

  try {
    const decodeAccessToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET)
    console.log("decoded", decodeAccessToken)
    res.json(decodeAccessToken)
  } catch (error) {
    console.log("decoded error", error)
  }
}

export async function handleLoginUser(req, res) {
  const { email, password } = req.body;

  //   console.log(email, password)
  if (!password || !email) {
    return res.status(400).send("All fields required.");
  }

  const userExists = await User.findOne({ email });

  console.log(password, userExists.password);

  if (!userExists) {
    return res.status(404).send("No user found.");
  }

  const matchPass = await userExists.isPasswordCorrect(password);

  // console.log(matchPass);

  if (!matchPass) {
    return res.status(401).send("Invalid credentials.");
  }

  try {
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      userExists._id
    );
    const loggedInUser = await User.findById(userExists._id).select(
      "-password -refreshToken"
    );

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: true, // Ensure this is true if using HTTPS
      sameSite: 'None', // Allows cross-site cookies
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true, // Ensure this is true if using HTTPS
      sameSite: 'None', // Allows cross-site cookies
    });
    res.status(200).json(loggedInUser);
  } catch (error) {
    res.status(500).send("Login failed. Please try again.");
  }
}

// Logout Handler
export async function handleLogoutUser(req, res) {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $unset: { refreshToken: 1 },
      },
      { new: true }
    );

    res
      .status(200)
      .cookie("accessToken", "", {
        ...accessTokenOptions,
        expires: new Date(0),
      })
      .cookie("refreshToken", "", {
        ...refreshTokenOptions,
        expires: new Date(0),
      })
      .send("Logout Successfully...");
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).send("Logout failed");
  }
}

// forgot password
export async function handleForgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send("Email is required");
  }

  console.log("Received forgot password request for email:", email);

  try {
    // Find the user in the database
    const user = await User.findOne({ email });

    if (!user) {
      console.log("No user found with this email:", email);
      return res.status(404).send("Invalid Email Address.");
    }

    console.log("User found:", user);

    // OAuth2 Credentials
    const CLIENT_ID = process.env.CLIENT_ID_FOR_MAIL;
    const CLIENT_SECRET = process.env.CLIENT_SECRET_FOR_MAIL;
    const REFRESH_TOKEN = process.env.REFRESH_TOKEN_FOR_MAIL;
    const REDIRECT_URI = "https://developers.google.com/oauthplayground";
    const MY_EMAIL = "muhammadhammadq882@gmail.com";

    const oAuth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    const sendTestEmail = async () => {
      try {
        const ACCESS_TOKEN = await oAuth2Client.getAccessToken();

        if (!ACCESS_TOKEN?.token) {
          throw new Error("Failed to retrieve access token. Check your OAuth2 configuration.");
        }

        console.log("Access token retrieved successfully.");

        const transport = nodemailer.createTransport({
          service: "gmail",
          auth: {
            type: "OAuth2",
            user: MY_EMAIL,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            refreshToken: REFRESH_TOKEN,
            accessToken: ACCESS_TOKEN.token,
          },
        });

        const resetLink = `https://tiny-url-frontend.vercel.app/resetPassword/${user._id}`;
        const mailOptions = {
          from: MY_EMAIL,
          to: user.email,
          subject: "Password Reset Request",
          html: `
            <p>Hi ${user.username},</p>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="${resetLink}" target="_blank">Reset Password</a>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Thanks,</p>
            <p>Your Team</p>
          `,
        };

        console.log("Sending email...");
        return await transport.sendMail(mailOptions);
      } catch (error) {
        console.error("Error while sending email:", error.message);
        throw error;
      }
    };

    // Call sendTestEmail
    await sendTestEmail();
    console.log("Password reset email sent successfully to:", user.email);
    res.status(200).send("Password reset email sent successfully.");
  } catch (error) {
    console.error("Error during forgot password process:", error.message);
    res.status(500).send("Error in sending forgot password email.");
  }
}


// Reset password
export async function handleResetPassword(req, res) {
  const { password } = req.body;
  const { id } = req.params;
  console.log(`Password: ${password}, ID: ${id}`);

  // Validate the provided password
  if (!password || password.length < 8) {
    return res
      .status(400)
      .send("Strong password required and must be at least 8 characters long.");
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the user's password in the database
    const resetPass = await User.findByIdAndUpdate(
      id,
      { password: hashedPassword },
      { new: true } // Return the updated document
    );

    if (!resetPass) {
      return res.status(404).send("User not found.");
    }

    res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Error in resetting password:", error);
    res.status(500).send("Internal Server Error");
  }
}
