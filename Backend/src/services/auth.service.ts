import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in environment');
}

export interface AuthResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthResult> {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error('EMAIL_IN_USE');
  }

  const user = await User.create({ name, email, password });
  return buildAuthResult(user);
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return buildAuthResult(user);
}

export async function getUserById(userId: string): Promise<{ id: string; name: string; email: string } | null> {
  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email
  };
}

function buildAuthResult(user: IUser): AuthResult {
  const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET as string, {
    expiresIn: JWT_EXPIRES_IN
  } as jwt.SignOptions);

  return {
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email
    }
  };
}

