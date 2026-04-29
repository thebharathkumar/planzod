import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { env } from "../env";

function isSesConfigured() {
  return Boolean(env.EMAIL_FROM && env.SES_REGION);
}

export async function sendEmail(options: { to: string; subject: string; html: string }) {
  if (!isSesConfigured()) {
    throw new Error("SES is not configured");
  }

  const client = new SESClient({ region: env.SES_REGION });
  const command = new SendEmailCommand({
    Destination: { ToAddresses: [options.to] },
    Message: {
      Subject: { Data: options.subject },
      Body: { Html: { Data: options.html } }
    },
    Source: env.EMAIL_FROM
  });

  await client.send(command);
}

