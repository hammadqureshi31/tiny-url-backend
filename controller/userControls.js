import { User } from "../model/userModel.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Define options for cookies
const accessTokenMaxAge = 24 * 60 * 60 * 1000; // 1 day in milliseconds
const refreshTokenMaxAge = 240 * 60 * 60 * 1000; // 10 days in milliseconds

export const accessTokenOptions = {
  maxAge: accessTokenMaxAge,
  httpOnly: true,
  secure: true,    // Must be true in production (for HTTPS)
  sameSite: 'lax', // Use 'lax' for cross-site requests
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

  if (!accessToken) return res.status(404).send("No Access Token Found...");

  try {
    const decodeAccessToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET)
    // console.log("decoded", decodeAccessToken)
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

  if (!email) return res.status(401).send("Email is required");

  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(404).send("Invalid Email Address.");

    var transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "muhammadhammadq882@gmail.com",
        pass: process.env.EMAIL_PASS_FOR_NODEMAILER,
      },
    });
    console.log("pass", process.env.EMAIL_PASS_FOR_NODEMAILER)
    console.log("forgot user", user.email)

    var mailOptions = {
      from: "muhammadhammadq882@gmail.com",
      to: user.email,
      subject: "Reset your password ",
      text: `https://tiny-url-frontend.vercel.app/resetPassword/${user._id}`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });
    res.status(200).send("Email sended..")
  } catch (error) {
    res.status(401).send("Error in send forgot password email");
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
