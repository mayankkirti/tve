const t = "They said, 'Hello [World] % 100!', \"wow\" :; & it was good.";
const escapeText4 = (str) => {
    return str
      .replace(/'/g, "'\\\\''")
      .replace(/%/g, "\\\\\\%");
};
console.log(escapeText4(t));
