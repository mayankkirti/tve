import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'system_config.json');

export let systemConfig = {
  diskLimitMB: 2048,
  password: "admin", // default password
  mfaCode: "",
  mfaExpiry: 0,
  totpSecret: ""
};

export function loadConfig() {
   try {
     if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        systemConfig = { ...systemConfig, ...data };
     }
   } catch(e) {}
}

export function saveConfig() {
   try {
     fs.writeFileSync(configPath, JSON.stringify(systemConfig, null, 2), 'utf8');
   } catch(e) {}
}

loadConfig();
