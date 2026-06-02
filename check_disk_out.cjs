// check_disk.cjs
var import_fs = require("fs");
try {
  const stat = (0, import_fs.statfsSync)(".");
  console.log("Free Space:", stat.bfree * stat.bsize / 1024 / 1024, "MB");
  console.log("Total Space:", stat.blocks * stat.bsize / 1024 / 1024, "MB");
} catch (e) {
  console.log("Error:", e);
}
