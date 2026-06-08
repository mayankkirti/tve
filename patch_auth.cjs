const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const loginStart = code.indexOf('app.post("/api/login"');
const logoutStart = code.indexOf('app.post("/api/logout"');
if (loginStart === -1 || logoutStart === -1) { console.error('Could not find endpoints'); process.exit(1); }
const replacement = `
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.APP_USERNAME || "admin";
  const expectedPass = systemConfig.password;
  if (username === expectedUser && password === expectedPass) {
    if (!systemConfig.totpSecret) {
       systemConfig.totpSecret = authenticator.generateSecret();
       saveConfig();
       const otpauth = authenticator.keyuri(expectedUser, 'TVE Auth', systemConfig.totpSecret);
       const qrCodeUrl = await qrcode.toDataURL(otpauth);
       return res.json({ mfaSetupRequired: true, qrCodeUrl, mfaRequired: true, secret: systemConfig.totpSecret });
    }
    res.json({ mfaRequired: true });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.post("/api/verify-mfa", (req, res) => {
  const { code } = req.body;
  if (!systemConfig.totpSecret) { return res.status(400).json({ error: "MFA not set up." }); }
  const isValid = authenticator.verify({ token: code, secret: systemConfig.totpSecret });
  if (isValid) {
     const token = uuidv4();
     activeTokens.add(token);
     res.json({ token });
  } else {
     res.status(401).json({ error: "Invalid code" });
  }
});
\n`;
code = code.substring(0, loginStart) + replacement + code.substring(logoutStart);
fs.writeFileSync('server.ts', code);
console.log('Authentication patched!');