#!/usr/bin/env node
const prompt = process.argv.slice(2).join(" ");
if (/username/i.test(prompt)) {
  process.stdout.write(process.env.GUIDED_PR_REVIEW_GIT_USERNAME || "x-access-token");
} else {
  process.stdout.write(process.env.GUIDED_PR_REVIEW_GIT_ASKPASS_TOKEN || "");
}
