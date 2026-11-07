export const PUBLIC_USER_FIELDS = 'firstName lastName name contactNumber email verificationMethod role isVerified subscriptionPlan accountStatus createdAt updatedAt';
export const PRIVATE_USER_FIELDS = [
  'password', 'otp', 'otpHash', 'otpExpires', 'otpAttempts', 'otpLastSentAt',
  'otpSendWindowStart', 'otpSendCount', 'resetPasswordOtp', 'resetPasswordOtpHash',
  'resetPasswordExpires', 'resetPasswordAttempts', 'resetPasswordLastSentAt',
  'resetPasswordSendWindowStart', 'resetPasswordSendCount', 'sessionVersion',
];
export const stripAuthFields = (_document, object) => {
  for (const field of PRIVATE_USER_FIELDS) delete object[field];
  return object;
};
export const userResponse = (user) => {
  if (!user) return null;
  const result = { _id: user._id };
  for (const field of PUBLIC_USER_FIELDS.split(' ')) {
    if (user[field] !== undefined) result[field] = user[field];
  }
  return result;
};
