import os from 'os';
import fs from 'fs';

console.log("Free Memory:", os.freemem() / 1024 / 1024, "MB");
console.log("Total Memory:", os.totalmem() / 1024 / 1024, "MB");
