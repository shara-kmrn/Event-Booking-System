import jwt from 'jsonwebtoken';
import { getSecurityConfig } from '../config/security.js';

export const generateToken = (user) => {
  const config = getSecurityConfig();
  return jwt.sign({ id: user._id.toString(), sv: user.sessionVersion || 0 }, config.secret, {
    algorithm: 'HS256', expiresIn: config.jwtTtlSeconds, issuer: config.issuer, audience: config.audience,
  });
};
export const verifyToken = (token) => {
  const config = getSecurityConfig();
  const decoded = jwt.verify(token, config.secret, {
    algorithms: ['HS256'], issuer: config.issuer, audience: config.audience,
  });
  if (typeof decoded !== 'object' || !/^[a-f0-9]{24}$/i.test(decoded.id || '') ||
      !Number.isInteger(decoded.sv) || decoded.sv < 0 || !Number.isInteger(decoded.exp)) {
    throw new Error('Invalid session.');
  }
  return decoded;
};
