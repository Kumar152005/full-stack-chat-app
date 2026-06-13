import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const services = [
  spawn(npmCommand, ["run", "dev", "--prefix", "backend"], { stdio: "inherit" }),
  spawn(npmCommand, ["run", "dev", "--prefix", "frontend"], { stdio: "inherit" }),
];

const stopServices = () => {
  for (const service of services) {
    if (!service.killed) service.kill("SIGTERM");
  }
};

for (const service of services) {
  service.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
    stopServices();
  });
}

process.on("SIGINT", stopServices);
process.on("SIGTERM", stopServices);
