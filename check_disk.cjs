import fs from 'fs';
import { statfsSync } from 'fs';

try {
  const stat = statfsSync('.');
  console.log("Free Space:", (stat.bfree * stat.bsize) / 1024 / 1024, "MB");
  console.log("Total Space:", (stat.blocks * stat.bsize) / 1024 / 1024, "MB");
} catch(e) {
  console.log("Error:", e);
}
