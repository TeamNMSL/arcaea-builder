import winston from "winston";

winston.add(
  new winston.transports.Console({
    level: "info",
    format: winston.format.combine(winston.format.cli())
  })
);

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  fatal(message: string): never;
}

global["logger"] = <Logger>{
  info: (message) => winston.info(message),
  warn: (message) => winston.warn(message),
  error: (message) => winston.error(message),
  fatal: (message) => {
    winston.error(message);
    process.exit(1);
  }
};
