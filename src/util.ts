import "./logger";

const utilName = process.argv[2];
const args = process.argv.slice(3);

require(`./utils/${utilName}`).default(args);
