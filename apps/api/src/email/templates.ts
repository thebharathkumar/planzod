type OrderEmailData = {
  attendeeEmail: string;
  eventTitle: string;
  startsAt: string;
  venueName: string;
  ticketCount: number;
};

export function renderOrderConfirmation(data: OrderEmailData) {
  const subject = `Your ticket for ${data.eventTitle}`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #111827;">
      <h2>You're in!</h2>
      <p>Thanks for your purchase. Here are your details:</p>
      <ul>
        <li><strong>Event:</strong> ${data.eventTitle}</li>
        <li><strong>Date:</strong> ${new Date(data.startsAt).toLocaleString()}</li>
        <li><strong>Venue:</strong> ${data.venueName}</li>
        <li><strong>Tickets:</strong> ${data.ticketCount}</li>
      </ul>
      <p>Show your QR code in Planzo at check‑in.</p>
    </div>
  `;
  return { subject, html };
}

export function renderOrganizerSummary(data: {
  organizerName: string;
  eventTitle: string;
  ticketsSold: number;
}) {
  const subject = `Sales update: ${data.eventTitle}`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #111827;">
      <h2>Sales update</h2>
      <p>Hi ${data.organizerName},</p>
      <p>${data.ticketsSold} tickets sold for <strong>${data.eventTitle}</strong>.</p>
    </div>
  `;
  return { subject, html };
}

export function renderWaitlistWelcome(data: { name?: string; referralLink: string }) {
  const subject = "Welcome to the Planzo waitlist";
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #111827;">
      <h2>You’re on the list 🎉</h2>
      <p>Thanks for joining Planzo. Share your link to move up the queue:</p>
      <p><a href="${data.referralLink}">${data.referralLink}</a></p>
    </div>
  `;
  return { subject, html };
}

export function renderWaitlistReward(data: { tier: string; referrals: number }) {
  const subject = `You reached ${data.tier} on Planzo`;
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #111827;">
      <h2>${data.tier} unlocked</h2>
      <p>You’ve referred ${data.referrals} people. Thanks for helping grow the community.</p>
      <p>We’ll be in touch with early access details.</p>
    </div>
  `;
  return { subject, html };
}
