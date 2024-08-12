export const port = process.env.PORT || 3000

export const mongodb_url = process.env.MONGODB_URL || "mongodb://localhost:27017/tinyURL"

export const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || "tiny-url";
export const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY || "1d";
export const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || "tiny-url-backend";
export const refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || "10d";

export const googleClientId = process.env.GOOGLE_CLIENT_ID 

export const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
