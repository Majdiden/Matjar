import jwt from "jsonwebtoken";

const signJWT = (data) => {
  return jwt.sign(data, "random secret");
};

const verifyJWT = (payload) => {
  return jwt.verify(payload, "random secret");
};

// define in your env file
const saltRounds = 10;

const generateHash = async (input) => {
  try {
    const hash = await bcrypt.hash(input, Number(saltRounds));
    return hash;
  } catch (error) {
    console.error("Error generating hash:", error);
    throw error;
  }
};

const comparePassword = async (plainPassword, hash) => {
  try {
    const match = await bcrypt.compare(plainPassword, hash);
    return match;
  } catch (error) {
    console.error("Error comparing password:", error);
    throw error;
  }
};

export { signJWT, verifyJWT, generateHash, comparePassword };
