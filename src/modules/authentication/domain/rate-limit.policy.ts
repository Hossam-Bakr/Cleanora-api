export const AUTH_RATE_LIMITS = {
  signup: { ip: [10, 900], subject: [3, 3600] },
  login: { ip: [20, 900], subject: [5, 900] },
  otpSend: { ip: [10, 900], subject: [3, 900] },
  otpVerify: { ip: [20, 900] },
  forgot: { ip: [5, 900], subject: [3, 3600] },
  reset: { ip: [5, 900] },
  refresh: { ip: [60, 300], subject: [30, 300] },
  google: { ip: [20, 900] }
} as const;
